/**
 * Entropy routes — venue entropy snapshot and advisory state.
 *
 * The entropy system is advisory only — it NEVER modifies PRE corpus.
 * Severity levels: NONE, ADVISORY, WARNING, CRITICAL
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getPool } from '../db/pool.js';

interface EntropyParams {
  venue_id: string;
}

export async function registerEntropyRoutes(app: FastifyInstance): Promise<void> {
  // GET /entropy/:venue_id — latest entropy report
  app.get<{ Params: EntropyParams }>(
    '/entropy/:venue_id',
    async (request: FastifyRequest<{ Params: EntropyParams }>, reply) => {
      const { venue_id } = request.params;
      const pool = getPool();
      const client = await pool.connect();

      try {
        // Latest report for venue
        const reportRows = await client.query<{
          entropy_report_id: string;
          scanned_at: string;
          severity: string;
          affected_screen_ids: string[];
          missing_asset_ids: string[];
          checksum_mismatches: number;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
        }>(
          `SELECT entropy_report_id, scanned_at, severity, affected_screen_ids,
                  missing_asset_ids, checksum_mismatches, acknowledged_at, acknowledged_by
           FROM entropy_reports
           WHERE venue_id = $1
           ORDER BY scanned_at DESC
           LIMIT 1`,
          [venue_id],
        );

        const report = reportRows.rows[0];

        if (!report) {
          return reply.code(200).send({
            venue_id,
            severity: 'NONE',
            last_scanned_at: null,
            message: 'No entropy scan has been run for this venue',
          });
        }

        return reply.code(200).send({
          venue_id,
          entropy_report_id: report.entropy_report_id,
          severity: report.severity,
          last_scanned_at: report.scanned_at,
          affected_screen_count: report.affected_screen_ids.length,
          affected_screen_ids: report.affected_screen_ids,
          missing_asset_count: report.missing_asset_ids.length,
          checksum_mismatches: report.checksum_mismatches,
          acknowledged: report.acknowledged_at !== null,
          acknowledged_at: report.acknowledged_at,
          acknowledged_by: report.acknowledged_by,
        });

      } finally {
        client.release();
      }
    },
  );

  // GET /entropy/:venue_id/summary — quick severity check (for polling)
  app.get<{ Params: EntropyParams }>(
    '/entropy/:venue_id/summary',
    async (request: FastifyRequest<{ Params: EntropyParams }>, reply) => {
      const { venue_id } = request.params;
      const pool = getPool();
      const client = await pool.connect();

      try {
        const rows = await client.query<{ severity: string; scanned_at: string }>(
          `SELECT severity, scanned_at FROM entropy_reports
           WHERE venue_id = $1 AND acknowledged_at IS NULL
           ORDER BY scanned_at DESC LIMIT 1`,
          [venue_id],
        );

        const row = rows.rows[0];
        return reply.code(200).send({
          venue_id,
          severity: row?.severity ?? 'NONE',
          at_utc_ms: Date.now(),
        });
      } finally {
        client.release();
      }
    },
  );
}
