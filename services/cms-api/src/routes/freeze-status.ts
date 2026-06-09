/**
 * Freeze state routes — Postgres-authoritative fallback for freeze delivery.
 *
 * Fast path:  Redis/WebSocket (unchanged — no modifications here)
 * Recovery path: these routes
 *
 * Why this exists:
 *   If Redis is down when an emergency freeze is issued, the WebSocket
 *   broadcast never fires. Players that disconnect or reconnect have no
 *   way to recover freeze state from the realtime layer. This provides
 *   a simple HTTP fallback that players call on reconnect.
 *
 * Invariant:
 *   Writes use a transaction. The partial unique index on freeze_state
 *   enforces exactly one current row per tenant at the DB level.
 *
 * What operators will do wrong:
 *   - Call POST /freeze while another freeze is pending
 *     → idempotent: already FROZEN returns 200, not error
 *   - Query with a tenant_id that has never had a freeze event
 *     → returns { state: "ACTIVE" } — explicit, never 404, never empty
 *   - Forget to unfreeze
 *     → no auto-expiry by design; freeze is intentional and must be cleared
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTransaction, query } from '../db/pool.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreezeStatusQuery {
  tenant_id: string;
}

interface FreezeParams {
  tenant_id: string;
}

interface FreezeBody {
  reason?: string;
}

interface FreezeStateRow {
  state: string;
  created_at: Date;
  reason: string | null;
}

// ── Write helper (exported for use by other routes that trigger freeze) ────────

/**
 * Atomically set freeze state for a tenant.
 * Marks any existing current row as non-current, then inserts new state.
 * Uses withTransaction — safe under concurrent requests.
 */
export async function writeFreezeState(
  tenantId: string,
  state: 'ACTIVE' | 'FROZEN',
  reason: string | null,
  createdBy: string | null,
): Promise<void> {
  await withTransaction(async (txQuery) => {
    // Step 1: retire current row (if any)
    await txQuery(
      `UPDATE freeze_state
       SET is_current = FALSE
       WHERE tenant_id = $1 AND is_current = TRUE`,
      [tenantId],
    );

    // Step 2: insert new current state
    await txQuery(
      `INSERT INTO freeze_state (tenant_id, state, reason, created_by, is_current)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [tenantId, state, reason, createdBy],
    );
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function registerFreezeStatusRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v2/freeze-status ─────────────────────────────────────────────
  // Player fallback: called on WebSocket disconnect, reconnect, or periodic poll.
  // Always returns a valid state — never 404, never empty body.
  // No auth required (players call this without operator context).

  app.get<{ Querystring: FreezeStatusQuery }>(
    '/api/v2/freeze-status',
    async (request, reply) => {
      const { tenant_id } = request.query;

      if (!tenant_id) {
        return reply.code(400).send({ error: 'tenant_id is required' });
      }

      const rows = await query<FreezeStateRow>(
        `SELECT state, created_at, reason
         FROM freeze_state
         WHERE tenant_id = $1 AND is_current = TRUE
         LIMIT 1`,
        [tenant_id],
      );

      // Explicit default: no row means no freeze has ever been issued → ACTIVE.
      // Never return 404 or empty — player must always get a deterministic answer.
      if (rows.length === 0) {
        return reply.send({
          tenant_id,
          state: 'ACTIVE',
          updated_at: null,
          reason: null,
        });
      }

      const row = rows[0]!;
      return reply.send({
        tenant_id,
        state: row.state,
        updated_at: row.created_at,
        reason: row.reason,
      });
    },
  );

  // ── POST /api/v2/tenants/:tenant_id/freeze ────────────────────────────────
  // Issue a freeze. Idempotent: freezing an already-frozen tenant is a no-op (200).
  // Requires operator auth.

  app.post<{ Params: FreezeParams; Body: FreezeBody }>(
    '/api/v2/tenants/:tenant_id/freeze',
    async (request, reply) => {
      const { tenant_id } = request.params;
      const { reason } = request.body ?? {};
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? null;

      // Check current state first — avoid writing if already frozen
      const current = await query<FreezeStateRow>(
        `SELECT state FROM freeze_state WHERE tenant_id = $1 AND is_current = TRUE LIMIT 1`,
        [tenant_id],
      );

      if (current[0]?.state === 'FROZEN') {
        return reply.send({
          tenant_id,
          state: 'FROZEN',
          message: 'Already frozen — no change made',
          at_utc_ms: Date.now(),
        });
      }

      try {
        await writeFreezeState(tenant_id, 'FROZEN', reason ?? null, operator_id);
      } catch (err: unknown) {
        // Unique index violation: two concurrent requests raced; the other won.
        // The tenant is frozen — this is the correct outcome.
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
          return reply.code(409).send({
            error: 'Concurrent freeze — freeze already applied by concurrent request',
            tenant_id,
          });
        }
        throw err;
      }

      app.log.info({ tenant_id, operator_id, reason }, 'Freeze issued');

      return reply.code(201).send({
        tenant_id,
        state: 'FROZEN',
        at_utc_ms: Date.now(),
      });
    },
  );

  // ── POST /api/v2/tenants/:tenant_id/unfreeze ──────────────────────────────
  // Clear a freeze. Idempotent: unfreezing an active tenant is a no-op (200).
  // Requires operator auth.

  app.post<{ Params: FreezeParams; Body: FreezeBody }>(
    '/api/v2/tenants/:tenant_id/unfreeze',
    async (request, reply) => {
      const { tenant_id } = request.params;
      const { reason } = request.body ?? {};
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? null;

      const current = await query<FreezeStateRow>(
        `SELECT state FROM freeze_state WHERE tenant_id = $1 AND is_current = TRUE LIMIT 1`,
        [tenant_id],
      );

      if (!current[0] || current[0].state === 'ACTIVE') {
        return reply.send({
          tenant_id,
          state: 'ACTIVE',
          message: 'Already active — no change made',
          at_utc_ms: Date.now(),
        });
      }

      await writeFreezeState(tenant_id, 'ACTIVE', reason ?? null, operator_id);

      app.log.info({ tenant_id, operator_id }, 'Freeze cleared');

      return reply.code(200).send({
        tenant_id,
        state: 'ACTIVE',
        at_utc_ms: Date.now(),
      });
    },
  );
}
