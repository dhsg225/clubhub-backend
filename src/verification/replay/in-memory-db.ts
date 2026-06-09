/**
 * In-memory database for replay execution.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §3.4
 * Invariant: INV-1 (Purity)
 *
 * The replay harness provides PRE with an in-memory database that:
 * 1. Serves all read queries from the static SystemStateSnapshot
 * 2. Throws InvariantViolationError if PRE attempts any write operation
 *
 * This is the runtime enforcement of INV-1 (Purity): PRE cannot write to the
 * database during replay, because the database throws on any write attempt.
 * A production PRE that writes will therefore be caught during CI replay.
 *
 * The database interface mimics the production database interface exactly,
 * so PRE code does not know it is running against an in-memory store.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import { InvariantViolationError } from '../invariants/types';

/**
 * Build an in-memory database handle from a SystemStateSnapshot.
 *
 * Returns an object that implements the same interface as the production
 * database connection, but:
 * - All SELECT queries return from the static snapshot
 * - All write operations throw InvariantViolationError immediately
 *
 * PRE.resolve() receives this object as its `db` parameter during replay.
 */
export function buildInMemoryDb(snapshot: SystemStateSnapshot): DatabaseHandle {
  return new InMemoryDatabase(snapshot);
}

// ─── Database Handle Interface ────────────────────────────────────────────────

/**
 * The subset of database operations that PRE is permitted to use.
 * PRE code depends on this interface, not a concrete implementation.
 *
 * Read methods return from snapshot; write methods throw.
 */
export interface DatabaseHandle {
  // ── Read operations (permitted) ──────────────────────────────────────────
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;

  // ── Write operations (FORBIDDEN in PRE) ──────────────────────────────────
  run(sql: string, params?: unknown[]): Promise<void>;
  insert<T>(table: string, record: T): Promise<void>;
  update(table: string, id: string, fields: Record<string, unknown>): Promise<void>;
  delete(table: string, id: string): Promise<void>;
  upsert<T>(table: string, record: T): Promise<void>;
}

// ─── In-Memory Database Implementation ───────────────────────────────────────

class InMemoryDatabase implements DatabaseHandle {
  private readonly snapshot: SystemStateSnapshot;

  constructor(snapshot: SystemStateSnapshot) {
    this.snapshot = snapshot;
  }

  /**
   * Execute a read query against the snapshot.
   *
   * The in-memory implementation uses a simple query router that maps
   * common PRE query patterns to snapshot collections. This is not a full
   * SQL engine — it handles the specific query shapes that PRE issues.
   *
   * If PRE issues a query shape not recognized by the router, it throws
   * rather than silently returning empty results (which could cause PRE
   * to fall to incorrect fallback behavior during replay).
   */
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.routeQuery<T>(sql, params ?? []);
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const results = await this.routeQuery<T>(sql, params ?? []);
    return results.length > 0 ? (results[0] as T) : null;
  }

  // ── Write operations — all throw InvariantViolationError ─────────────────

  async run(sql: string, _params?: unknown[]): Promise<void> {
    this.throwWriteViolation('run', sql);
  }

  async insert<T>(_table: string, _record: T): Promise<void> {
    this.throwWriteViolation('insert', _table);
  }

  async update(_table: string, _id: string, _fields: Record<string, unknown>): Promise<void> {
    this.throwWriteViolation('update', _table);
  }

  async delete(_table: string, _id: string): Promise<void> {
    this.throwWriteViolation('delete', _table);
  }

  async upsert<T>(_table: string, _record: T): Promise<void> {
    this.throwWriteViolation('upsert', _table);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private throwWriteViolation(operation: string, target: string): never {
    throw new InvariantViolationError({
      invariantId: 'INV-1',
      passed: false,
      severity: 'CONSTITUTIONAL_BREACH',
      message:
        `PURITY VIOLATION: PRE attempted a write operation during replay. ` +
        `Operation: "${operation}" on "${target}". ` +
        `PRE.resolve() is a pure function — it MUST NOT write to any database table. ` +
        `This is a violation of INV-1 (Purity) and Forbidden Pattern FP-02.`,
      detail: { operation, target },
    });
  }

  private routeQuery<T>(sql: string, params: unknown[]): T[] {
    const normalized = sql.trim().toLowerCase().replace(/\s+/g, ' ');
    const snap = this.snapshot;

    // Route based on table name detected in the SQL
    // These patterns match the canonical query shapes in src/pre/queries/

    if (normalized.includes('from screens') || normalized.includes('from "screens"')) {
      if (params[0] === snap.screen.id) {
        return [snap.screen] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from tv_groups') || normalized.includes('from "tv_groups"')) {
      if (snap.tv_group && params[0] === snap.tv_group.id) {
        return [snap.tv_group] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from areas') || normalized.includes('from "areas"')) {
      if (snap.area && params[0] === snap.area.id) {
        return [snap.area] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from venues') || normalized.includes('from "venues"')) {
      if (params[0] === snap.venue.id) {
        return [snap.venue] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from organizations') || normalized.includes('from "organizations"')) {
      if (params[0] === snap.organization.id) {
        return [snap.organization] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from emergency_states') || normalized.includes('from "emergency_states"')) {
      if (snap.emergency) {
        return [snap.emergency] as unknown as T[];
      }
      return [];
    }

    if (normalized.includes('from overrides') || normalized.includes('from "overrides"')) {
      return snap.overrides as unknown as T[];
    }

    if (normalized.includes('from schedules') || normalized.includes('from "schedules"')) {
      return snap.schedules as unknown as T[];
    }

    if (normalized.includes('from campaigns') || normalized.includes('from "campaigns"')) {
      return snap.campaigns as unknown as T[];
    }

    if (normalized.includes('from content_items') || normalized.includes('from "content_items"')) {
      return snap.content_items as unknown as T[];
    }

    if (normalized.includes('from sponsorship_contracts') || normalized.includes('from "sponsorship_contracts"')) {
      return snap.sponsorships as unknown as T[];
    }

    if (normalized.includes('from delivery_log') || normalized.includes('from "delivery_log"')) {
      if (snap.last_delivery) {
        return [snap.last_delivery] as unknown as T[];
      }
      return [];
    }

    // Unknown query shape — throw rather than silently return empty
    throw new Error(
      `InMemoryDatabase: unrecognized query shape — cannot route to snapshot. ` +
      `SQL: "${sql}". ` +
      `This means PRE is issuing a query that the replay harness does not know how to serve. ` +
      `Add a route handler in in-memory-db.ts for this query pattern.`
    );
  }
}
