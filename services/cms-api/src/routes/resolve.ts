/**
 * Resolution routes — connects HTTP to PRE.resolve() via real DB.
 *
 * Wave 1 implementation:
 * - GET /resolve/:screen_id → buildSystemStateSnapshot → resolve → audit
 * - GET /preview/:screen_id → same but with PREVIEW: prefix on checksum
 *
 * Constitutional rules enforced:
 * - Correlation ID on every request
 * - Audit record written on every resolution
 * - PREVIEW: prefix never stripped
 * - Deterministic serialization (sorted keys)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildSystemStateSnapshot, SnapshotBuildError } from '../db/snapshot-builder.js';
import { writeAuditRecord, writeDeliveryLog } from '../db/repositories/audit-repository.js';
import { randomUUID } from 'node:crypto';

let resolveFunc: ((input: unknown) => unknown) | null = null;

async function getResolve(): Promise<(input: unknown) => unknown> {
  if (resolveFunc !== null) return resolveFunc;
  const mod = await import('@clubhub/pre-engine');
  resolveFunc = mod.resolve as (input: unknown) => unknown;
  return resolveFunc;
}

interface ResolveParams {
  screen_id: string;
}

type PreOutputResolved = {
  screen_id: string;
  resolved_at: number;
  resolution_level: number;
  is_fallback: boolean;
  playlist_checksum: string;
  playlist: unknown[];
  content_mix: unknown;
  reason_trace: unknown;
  version: number;
  output_schema_version: string;
  confidence_score: number;
};

export async function registerResolveRoutes(app: FastifyInstance): Promise<void> {

  // GET /resolve/:screen_id
  app.get<{ Params: ResolveParams }>(
    '/resolve/:screen_id',
    async (request: FastifyRequest<{ Params: ResolveParams }>, reply: FastifyReply) => {
      const { screen_id } = request.params;
      const correlationId = (request.headers['x-correlation-id'] as string | undefined)
        ?? randomUUID();
      const atMs = Date.now();

      try {
        const systemState = await buildSystemStateSnapshot(screen_id, atMs);

        const resolve = await getResolve();
        const preOutput = resolve({ screen_id, at: atMs, system_state: systemState }) as PreOutputResolved;

        try {
          await writeAuditRecord(
            preOutput as Parameters<typeof writeAuditRecord>[0],
            screen_id,
            systemState.venue.id,
            atMs,
            correlationId,
            true,
          );
          await writeDeliveryLog(screen_id, preOutput.playlist_checksum, preOutput.resolution_level);
        } catch (auditErr) {
          request.log.error({ err: auditErr, correlation_id: correlationId }, 'Audit write failed');
        }

        return reply
          .code(200)
          .header('x-correlation-id', correlationId)
          .header('x-playlist-checksum', preOutput.playlist_checksum)
          .header('x-resolution-level', String(preOutput.resolution_level))
          .header('x-replay-compatible', 'true')
          .send({
            screen_id: preOutput.screen_id,
            resolved_at: preOutput.resolved_at,
            resolution_level: preOutput.resolution_level,
            is_fallback: preOutput.is_fallback,
            playlist_checksum: preOutput.playlist_checksum,
            playlist: preOutput.playlist,
            content_mix: preOutput.content_mix,
            reason_trace: preOutput.reason_trace,
            version: preOutput.version,
            output_schema_version: preOutput.output_schema_version,
            confidence_score: preOutput.confidence_score,
            _meta: {
              correlation_id: correlationId,
              at_utc_ms: atMs,
              venue_id: systemState.venue.id,
            },
          });

      } catch (err) {
        if (err instanceof SnapshotBuildError) {
          return reply.code(404).send({
            error: 'Screen not found',
            screen_id,
            correlation_id: correlationId,
          });
        }
        request.log.error({ err, correlation_id: correlationId }, 'Resolution failed');
        return reply.code(500).send({
          error: 'Resolution failed',
          correlation_id: correlationId,
        });
      }
    },
  );

  // GET /preview/:screen_id
  app.get<{ Params: ResolveParams }>(
    '/preview/:screen_id',
    async (request: FastifyRequest<{ Params: ResolveParams }>, reply: FastifyReply) => {
      const { screen_id } = request.params;
      const correlationId = (request.headers['x-correlation-id'] as string | undefined)
        ?? randomUUID();
      const atMs = parseInt((request.query as Record<string, string>)['at'] ?? String(Date.now()), 10);

      try {
        const systemState = await buildSystemStateSnapshot(screen_id, atMs);
        const resolve = await getResolve();
        const preOutput = resolve({ screen_id, at: atMs, system_state: systemState }) as PreOutputResolved & { [key: string]: unknown };

        // Constitutional: PREVIEW: prefix must never be stripped
        const previewChecksum = `PREVIEW:${preOutput.playlist_checksum}`;

        return reply
          .code(200)
          .header('x-correlation-id', correlationId)
          .header('x-playlist-checksum', previewChecksum)
          .header('x-preview', 'true')
          .send({
            ...preOutput,
            playlist_checksum: previewChecksum,
            _preview: true,
            _preview_at_utc_ms: atMs,
            _meta: {
              correlation_id: correlationId,
              at_utc_ms: atMs,
              venue_id: systemState.venue.id,
            },
          });

      } catch (err) {
        if (err instanceof SnapshotBuildError) {
          return reply.code(404).send({ error: 'Screen not found', screen_id });
        }
        return reply.code(500).send({ error: 'Preview failed' });
      }
    },
  );
}
