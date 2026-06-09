'use strict';
/**
 * distributed-authority.js
 *
 * DB-backed authority lease for multi-instance rollout coordination.
 * Only one row ever exists in authority_leases (lease_id = 'singleton').
 * Lease TTL defaults to 30 seconds.
 */

const os   = require('node:os');

const LEASE_TTL_MS = parseInt(process.env.AUTHORITY_LEASE_TTL_MS ?? '30000', 10);

const HOLDER_ID = process.env.BACKEND_INSTANCE_ID
  ?? `${os.hostname()}:${process.pid}`;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS authority_leases (
    lease_id      TEXT PRIMARY KEY DEFAULT 'singleton',
    holder_id     TEXT NOT NULL,
    epoch         INTEGER NOT NULL DEFAULT 1,
    acquired_at   BIGINT NOT NULL,
    expires_at    BIGINT NOT NULL,
    frozen        BOOLEAN NOT NULL DEFAULT false,
    freeze_reason TEXT,
    updated_at    BIGINT NOT NULL
  )
`;

class DistributedAuthority {
  constructor(pool) {
    this._pool      = pool ?? null;
    this._holderId  = HOLDER_ID;
    this._ttl       = LEASE_TTL_MS;
    this._eventLog  = [];
  }

  async init() {
    await this._pool.query(CREATE_TABLE_SQL);
    await this.acquireLease();
  }

  /**
   * Attempt to acquire or renew the singleton lease.
   * Only succeeds if the lease is expired OR already held by this instance.
   * @returns {{ acquired: boolean, holder_id: string, epoch: number }}
   */
  async acquireLease() {
    const now = Date.now();
    const expiresAt = now + this._ttl;

    try {
      const insertResult = await this._pool.query(
        `INSERT INTO authority_leases (lease_id, holder_id, epoch, acquired_at, expires_at, frozen, updated_at)
         VALUES ('singleton', $1, 1, $2, $3, false, $4)
         ON CONFLICT (lease_id) DO UPDATE
           SET holder_id   = CASE WHEN authority_leases.expires_at < $5 OR authority_leases.holder_id = $1
                                  THEN $1 ELSE authority_leases.holder_id END,
               epoch       = CASE WHEN authority_leases.expires_at < $5 AND authority_leases.holder_id != $1
                                  THEN authority_leases.epoch + 1 ELSE authority_leases.epoch END,
               acquired_at = CASE WHEN authority_leases.expires_at < $5 OR authority_leases.holder_id = $1
                                  THEN $2 ELSE authority_leases.acquired_at END,
               expires_at  = CASE WHEN authority_leases.expires_at < $5 OR authority_leases.holder_id = $1
                                  THEN $3 ELSE authority_leases.expires_at END,
               updated_at  = $4
         RETURNING holder_id, epoch`,
        [this._holderId, now, expiresAt, now, now]
      );

      const row = insertResult.rows[0];
      const acquired = row?.holder_id === this._holderId;

      if (acquired) {
        this.emitEvent('AUTHORITY.acquired', { holder_id: this._holderId, epoch: row.epoch });
      } else {
        this.emitEvent('AUTHORITY.lost', { current_holder: row?.holder_id });
      }

      return {
        acquired,
        holder_id: row?.holder_id ?? null,
        epoch:     row?.epoch     ?? null,
      };
    } catch (err) {
      this.emitEvent('AUTHORITY.conflict', { error: err.message });
      return { acquired: false, holder_id: null, epoch: null };
    }
  }

  /**
   * Release the lease (set expires_at = 0 to force expiry).
   */
  async releaseLease() {
    await this._pool.query(
      `UPDATE authority_leases SET expires_at = 0, updated_at = $1
       WHERE lease_id = 'singleton' AND holder_id = $2`,
      [Date.now(), this._holderId]
    );
  }

  /**
   * Renew the lease TTL (only if this instance holds it).
   */
  async renewLease() {
    const now = Date.now();
    await this._pool.query(
      `UPDATE authority_leases SET expires_at = $1, updated_at = $2
       WHERE lease_id = 'singleton' AND holder_id = $3`,
      [now + this._ttl, now, this._holderId]
    );
  }

  /**
   * Returns true if this instance currently holds a valid (non-expired) lease.
   */
  async isLeaseHolder() {
    const row = await this.getState();
    if (!row) return false;
    return row.holder_id === this._holderId && row.expires_at > Date.now();
  }

  /**
   * Propagate a freeze across all instances (stored in DB).
   */
  async propagateFreeze(reason) {
    await this._pool.query(
      `UPDATE authority_leases SET frozen = true, freeze_reason = $1, updated_at = $2
       WHERE lease_id = 'singleton'`,
      [reason ?? null, Date.now()]
    );
    this.emitEvent('AUTHORITY.freeze_propagated', { reason });
  }

  /**
   * Clear a previously propagated freeze.
   */
  async clearFreeze() {
    await this._pool.query(
      `UPDATE authority_leases SET frozen = false, freeze_reason = NULL, updated_at = $1
       WHERE lease_id = 'singleton'`,
      [Date.now()]
    );
  }

  /**
   * Return the current lease row, or null if none exists.
   */
  async getState() {
    const result = await this._pool.query(
      `SELECT * FROM authority_leases WHERE lease_id = 'singleton'`
    );
    return result.rows[0] ?? null;
  }

  emitEvent(eventName, payload) {
    this._eventLog.push({
      event:   eventName,
      payload: payload ?? {},
      ts:      new Date().toISOString(),
    });
  }

  getEventLog() {
    return [...this._eventLog];
  }
}

// ── DB Failure Governance Model ───────────────────────────────────────────────
//
// Defines the authoritative behaviour of each governance subsystem during a
// DB outage. Operators must understand these semantics before deploying
// active/active HA. See HA_SAFETY_MODEL below for full deployment ceiling.

/**
 * DB_FAILURE_MODE — what each subsystem does when the DB is unreachable.
 *
 * CACHE_STALE_ALLOW  — uses last in-memory value; stale by up to TTL window
 * BLOCKED            — operation refuses to proceed; returns error to caller
 * MEMORY_FALLBACK    — uses in-memory counter; may diverge across instances
 * CACHE_SERVE        — serves stale cached content; screens stay functional
 * QUEUE_IN_MEMORY    — writes buffered; will attempt DB write on recovery
 * MEMORY_ONLY        — no cluster coordination; instances act independently
 * READ_ONLY          — reads from last cached state; no new governed mutations
 */
const DB_FAILURE_MODE = Object.freeze({
  FREEZE_READS:    'CACHE_STALE_ALLOW',  // isRolloutFrozenFromDb falls back to memory
  PROMOTIONS:      'CACHE_STALE_ALLOW',  // see FREEZE_READS — stale freeze may allow unsafe promote
  EPOCH_READS:     'MEMORY_FALLBACK',    // getEpoch() always reads memory
  EPOCH_INCREMENT: 'MEMORY_FALLBACK',    // incrementEpoch falls back to ++_epoch
  MANIFEST_GEN:    'MEMORY_FALLBACK',    // incrementManifestGeneration falls back to ++_gen
  MANIFESTS:       'CACHE_SERVE',        // getManifest returns stale cache
  LEDGER_WRITES:   'QUEUE_IN_MEMORY',    // appendEntry fires-and-forgets; linearized path throws
  LEDGER_LINEARIZED: 'BLOCKED',          // appendEntryLinearized throws on DB failure
  INCIDENTS:       'MEMORY_ONLY',        // transitionStrong falls back to in-memory transition
  GOVERNANCE:      'READ_ONLY',          // governed-config.get() returns cached config
});

/**
 * HA_SAFETY_MODEL — formal deployment ceiling for this architecture.
 *
 * SAFE DEPLOYMENT TOPOLOGIES:
 *   ✓ Single instance                — fully safe; all governance is authoritative
 *   ✓ Active/passive (standby)       — safe if only one instance processes writes at a time
 *   ✓ Active/active (read replicas)  — safe if manifest reads only, no OTA promotion writes
 *
 * UNSAFE WITHOUT ADDITIONAL COORDINATION:
 *   ✗ Active/active (both promoting) — freeze reads are CACHE_STALE_ALLOW; stale freeze window
 *                                       is bounded by DB round-trip latency (~1-5ms on LAN)
 *   ✗ Active/active (ledger writes)  — appendEntry (non-linearized) diverges hash chain
 *                                       across instances; use appendEntryLinearized for critical writes
 *
 * REMAINING RISKS IN ACTIVE/ACTIVE:
 *   1. Freeze staleness window: between `_setFreeze` writing DB and the next DB read
 *      on another instance, a promotion can slip through. Window = DB write latency.
 *      Mitigation: promotion path uses getFreezeStateStrong() (strong read).
 *
 *   2. Epoch divergence: two instances starting simultaneously both increment epoch.
 *      Epoch goes up by 2 instead of 1. Nodes see two AUTHORITY_LOSS events.
 *      This is CORRECT behaviour — two authority events occurred. Not a bug.
 *
 *   3. Artifact generation double-increment: two instances for DIFFERENT nodes
 *      can concurrently increment generation. This is correct (each node change
 *      is an independent event). For the SAME node, SELECT FOR UPDATE serializes.
 *
 *   4. Ledger hash chain: appendEntry (synchronous, in-memory) can diverge if two
 *      instances append concurrently. appendEntryLinearized solves this for critical
 *      paths. Legacy callers using appendEntry are advisory-only.
 *
 *   5. Incident transitions: transitionStrong uses advisory lock + version check.
 *      The synchronous transition() method is advisory-only for active/active.
 *
 * DEPLOYMENT CEILING:
 *   With the current architecture, active/active is OPERATIONALLY SAFE for:
 *     - Read traffic (artifact delivery)
 *     - Status/health endpoints
 *     - Node heartbeat recording
 *   Active/active is CONDITIONALLY SAFE for:
 *     - Deployment promotion (using getFreezeStateStrong for freeze check)
 *     - Incident transitions (using transitionStrong)
 *     - Ledger appends (using appendEntryLinearized)
 *   The remaining ADVISORY_ONLY behaviour:
 *     - appendEntry() (non-linearized) — hash chain advisory across instances
 *     - getEpoch() / getArtifactGeneration() — synchronous, in-memory reads
 */
const HA_SAFETY_MODEL = Object.freeze({
  topology: {
    single_instance:         'SAFE',
    active_passive:          'SAFE',
    active_active_reads:     'SAFE',
    active_active_writes:    'CONDITIONALLY_SAFE',
  },
  safe_paths: [
    'artifact delivery (read)',
    'health/status endpoints',
    'node heartbeat recording',
    'deployment promotion via getFreezeStateStrong + strong read',
    'incident transition via transitionStrong',
    'ledger append via appendEntryLinearized',
  ],
  advisory_only: [
    'appendEntry() — non-linearized hash chain',
    'getEpoch() / getArtifactGeneration() — in-memory reads',
    'transition() — non-serialized incident transition',
  ],
  db_failure_behaviour: DB_FAILURE_MODE,
});

module.exports = { DistributedAuthority, HOLDER_ID, LEASE_TTL_MS, DB_FAILURE_MODE, HA_SAFETY_MODEL };
