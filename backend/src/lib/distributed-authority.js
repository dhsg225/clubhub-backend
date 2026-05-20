'use strict';
/**
 * distributed-authority.js
 *
 * DB-backed authority lease for multi-instance rollout coordination.
 * Only one row ever exists in authority_leases (lease_id = 'singleton').
 * Lease TTL defaults to 30 seconds.
 */

const os   = require('node:os');
const { pool: defaultPool } = require('../db');

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
    this._pool      = pool ?? defaultPool;
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
      // Try insert first (no existing lease)
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

module.exports = { DistributedAuthority, HOLDER_ID, LEASE_TTL_MS };
