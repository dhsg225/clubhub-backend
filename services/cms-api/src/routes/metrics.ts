/**
 * Prometheus metrics endpoint.
 *
 * Exposes key constitutional operational metrics in text format.
 * Does not use prom-client (adds complexity) — emits manual metric text.
 */
import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/pool.js';

interface MetricCounts {
  total_resolutions: number;
  fallback_resolutions: number;
  resolution_by_level: Record<number, number>;
  total_audit_records: number;
  active_emergencies: number;
  entropy_critical_count: number;
}

async function collectMetrics(): Promise<MetricCounts> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [audits, emergencies, entropy] = await Promise.all([
      client.query<{ total: string; fallback: string; level: number }>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE is_fallback = true) AS fallback,
          resolution_level AS level
        FROM replay_audit_records
        GROUP BY resolution_level
        ORDER BY resolution_level ASC
      `),
      client.query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM emergency_events WHERE cleared_at IS NULL
      `),
      client.query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM entropy_reports
        WHERE severity = 'CRITICAL' AND acknowledged_at IS NULL
      `),
    ]);

    const byLevel: Record<number, number> = {};
    let totalResolutions = 0;
    let fallbackResolutions = 0;

    for (const row of audits.rows) {
      const count = parseInt(row.total, 10);
      byLevel[row.level] = count;
      totalResolutions += count;
      fallbackResolutions += parseInt(row.fallback, 10);
    }

    return {
      total_resolutions: totalResolutions,
      fallback_resolutions: fallbackResolutions,
      resolution_by_level: byLevel,
      total_audit_records: totalResolutions,
      active_emergencies: parseInt(emergencies.rows[0]?.count ?? '0', 10),
      entropy_critical_count: parseInt(entropy.rows[0]?.count ?? '0', 10),
    };
  } finally {
    client.release();
  }
}

function formatPrometheus(metrics: MetricCounts): string {
  const lines: string[] = [];

  lines.push('# HELP clubhub_pre_resolutions_total Total PRE resolutions');
  lines.push('# TYPE clubhub_pre_resolutions_total counter');
  lines.push(`clubhub_pre_resolutions_total ${metrics.total_resolutions}`);

  lines.push('# HELP clubhub_pre_fallback_resolutions_total Fallback (LEVEL_5) resolutions');
  lines.push('# TYPE clubhub_pre_fallback_resolutions_total counter');
  lines.push(`clubhub_pre_fallback_resolutions_total ${metrics.fallback_resolutions}`);

  for (const [level, count] of Object.entries(metrics.resolution_by_level)) {
    lines.push(`clubhub_pre_resolutions_by_level{level="${level}"} ${count}`);
  }

  lines.push('# HELP clubhub_audit_records_total Total immutable audit records in DB');
  lines.push('# TYPE clubhub_audit_records_total counter');
  lines.push(`clubhub_audit_records_total ${metrics.total_audit_records}`);

  lines.push('# HELP clubhub_active_emergencies Active emergency events');
  lines.push('# TYPE clubhub_active_emergencies gauge');
  lines.push(`clubhub_active_emergencies ${metrics.active_emergencies}`);

  lines.push('# HELP clubhub_entropy_critical_unresolved Unresolved CRITICAL entropy reports');
  lines.push('# TYPE clubhub_entropy_critical_unresolved gauge');
  lines.push(`clubhub_entropy_critical_unresolved ${metrics.entropy_critical_count}`);

  return lines.join('\n') + '\n';
}

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (_request, reply) => {
    try {
      const metrics = await collectMetrics();
      const text = formatPrometheus(metrics);
      return reply
        .code(200)
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(text);
    } catch (err) {
      return reply.code(500).send({ error: 'Metrics collection failed', detail: String(err) });
    }
  });
}
