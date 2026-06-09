import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { loadConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { initPool } from './db.js';
import { EntropyScheduler } from './entropy-scheduler.js';

interface EntropyReportRow {
  entropy_report_id: string;
  venue_id: string;
  scanned_at: string;
  severity: string;
  affected_screen_ids: string[];
  missing_asset_ids: string[];
  checksum_mismatches: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export async function buildApp(pool: Pool, enableLogger = false): Promise<FastifyInstance> {
  const app = Fastify({ logger: enableLogger });

  await registerHealthRoutes(app);

  // GET /entropy/advisory/:venue_id — latest entropy advisory for a venue
  app.get<{ Params: { venue_id: string } }>(
    '/entropy/advisory/:venue_id',
    async (request, reply) => {
      const { venue_id } = request.params;
      const client = await pool.connect();
      try {
        const result = await client.query<EntropyReportRow>(
          `SELECT entropy_report_id, venue_id, scanned_at, severity,
                  affected_screen_ids, missing_asset_ids, checksum_mismatches,
                  acknowledged_at, acknowledged_by
           FROM entropy_reports
           WHERE venue_id = $1
           ORDER BY scanned_at DESC
           LIMIT 1`,
          [venue_id],
        );
        const report = result.rows[0];

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

  // GET /entropy/scan — trigger an immediate scan across all known venues, return summary
  app.get(
    '/entropy/scan',
    async (_request, reply) => {
      const client = await pool.connect();
      try {
        // Collect distinct venue IDs from venues table
        const venueResult = await client.query<{ venue_id: string }>(
          `SELECT venue_id FROM venues ORDER BY venue_id`,
        );
        const venues = venueResult.rows;

        if (venues.length === 0) {
          return reply.code(200).send({
            scanned_venues: 0,
            results: [],
            at_utc_ms: Date.now(),
          });
        }

        // Write a NONE-severity advisory row for each venue (placeholder scan;
        // real checksum comparison is Wave 5 scope).
        const results: Array<{ venue_id: string; severity: string; entropy_report_id: string }> = [];
        for (const { venue_id } of venues) {
          const insertResult = await client.query<{ entropy_report_id: string }>(
            `INSERT INTO entropy_reports
               (venue_id, severity, affected_screen_ids, missing_asset_ids, checksum_mismatches)
             VALUES ($1, 'NONE', '{}', '{}', 0)
             RETURNING entropy_report_id`,
            [venue_id],
          );
          const inserted = insertResult.rows[0];
          if (!inserted) throw new Error('INSERT returned no row');
          results.push({
            venue_id,
            severity: 'NONE',
            entropy_report_id: inserted.entropy_report_id,
          });
        }

        return reply.code(200).send({
          scanned_venues: venues.length,
          results,
          at_utc_ms: Date.now(),
        });
      } finally {
        client.release();
      }
    },
  );

  return app;
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const pool = initPool();

  const app = await buildApp(pool, true);

  // Start entropy scheduler
  const scheduler = new EntropyScheduler({
    venueScanIntervalMs: config.VENUE_SCAN_INTERVAL_MS,
    fleetScanIntervalMs: config.FLEET_SCAN_INTERVAL_MS,
  });

  scheduler.start(
    () => {
      // Venue IDs fetched async on each tick — return empty synchronously;
      // scheduler will iterate nothing if list is empty on first tick.
      // A production implementation would maintain a cached venue list.
      return [];
    },
    async (venueId) => {
      const client = await pool.connect();
      try {
        const result = await client.query<{ corpus_version_id: string; checksum: string }>(
          `SELECT cv.corpus_version_id, cv.checksum
           FROM corpus_versions cv
           JOIN venues v ON v.active_corpus_version_id = cv.corpus_version_id
           WHERE v.venue_id = $1
           LIMIT 1`,
          [venueId],
        );
        const corpus = result.rows[0];
        return {
          venue_id: venueId,
          corpus_version: corpus?.corpus_version_id ?? 'unknown',
          expected_checksum: corpus?.checksum ?? '',
          actual_checksum: null,
          scanned_at: Date.now(),
        };
      } finally {
        client.release();
      }
    },
  );

  // Stop scheduler on graceful shutdown
  app.addHook('onClose', async () => {
    scheduler.stop();
  });

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}
