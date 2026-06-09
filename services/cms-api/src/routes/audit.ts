/**
 * Audit routes — read-only access to replay_audit_records.
 *
 * Constitutional rules:
 * - Records are NEVER modified or deleted via API
 * - All queries include explicit time bounds
 * - Returns records in deterministic order (created_at ASC, audit_record_id ASC)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getPool } from '../db/pool.js';

interface AuditQuerystring {
  screen_id?: string;
  venue_id?: string;
  limit?: string;
  since?: string;
}

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  // GET /audit/records — query replay audit records
  app.get<{ Querystring: AuditQuerystring }>(
    '/audit/records',
    async (request: FastifyRequest<{ Querystring: AuditQuerystring }>, reply) => {
      const { screen_id, venue_id, limit = '50', since } = request.query;

      if (!screen_id && !venue_id) {
        return reply.code(400).send({ error: 'screen_id or venue_id required' });
      }

      const limitNum = Math.min(parseInt(limit, 10), 500);
      const sinceTs = since ? new Date(parseInt(since, 10)).toISOString() : new Date(0).toISOString();

      const pool = getPool();
      const client = await pool.connect();

      try {
        const rows = await client.query<{
          audit_record_id: string;
          created_at: string;
          screen_id: string;
          venue_id: string;
          at_utc_ms: string;
          correlation_id: string;
          playlist_checksum: string;
          resolution_level: number;
          is_fallback: boolean;
          invariants_passed: boolean;
          record_checksum: string;
        }>(
          `SELECT audit_record_id, created_at, screen_id, venue_id, at_utc_ms,
                  correlation_id, playlist_checksum, resolution_level, is_fallback,
                  invariants_passed, record_checksum
           FROM replay_audit_records
           WHERE ($1::uuid IS NULL OR screen_id = $1)
             AND ($2::uuid IS NULL OR venue_id = $2)
             AND created_at >= $3
           ORDER BY created_at ASC, audit_record_id ASC
           LIMIT $4`,
          [screen_id ?? null, venue_id ?? null, sinceTs, limitNum],
        );

        return reply.code(200).send({
          records: rows.rows,
          count: rows.rows.length,
          at_utc_ms: Date.now(),
        });
      } finally {
        client.release();
      }
    },
  );

  // GET /audit/verify/:audit_record_id — verify a single record's checksum
  app.get<{ Params: { audit_record_id: string } }>(
    '/audit/verify/:audit_record_id',
    async (request, reply) => {
      const { audit_record_id } = request.params;
      const pool = getPool();
      const client = await pool.connect();

      try {
        const rows = await client.query<{
          audit_record_id: string;
          created_at: string;
          screen_id: string;
          venue_id: string;
          at_utc_ms: string;
          correlation_id: string;
          playlist_checksum: string;
          resolution_level: number;
          is_fallback: boolean;
          invariants_passed: boolean;
          record_checksum: string;
        }>(
          `SELECT * FROM replay_audit_records WHERE audit_record_id = $1`,
          [audit_record_id],
        );

        const record = rows.rows[0];
        if (!record) {
          return reply.code(404).send({ error: 'Audit record not found' });
        }

        // Re-compute checksum for verification.
        // CRITICAL: must use exact same types as audit-repository.ts at write time:
        //   - at_utc_ms: number (not string — pg returns BIGINT as string)
        //   - resolution_level: number
        //   - is_fallback: boolean
        //   - invariants_passed: boolean
        const { fnv1a32, canonicalizeJson } = await import('@clubhub/fnv-checksum');
        const { record_checksum: storedChecksum, ...rawFields } = record;
        // Reconstruct with write-time JS types
        const fields = {
          ...rawFields,
          at_utc_ms: Number(rawFields.at_utc_ms),
          resolution_level: Number(rawFields.resolution_level),
          is_fallback: Boolean(rawFields.is_fallback),
          invariants_passed: Boolean(rawFields.invariants_passed),
        };
        const computedChecksum = fnv1a32(canonicalizeJson(fields)).toString(16).padStart(8, '0');
        const valid = computedChecksum === storedChecksum;

        return reply.code(200).send({
          audit_record_id,
          checksum_valid: valid,
          stored_checksum: storedChecksum,
          computed_checksum: computedChecksum,
          record,
        });
      } finally {
        client.release();
      }
    },
  );
}
