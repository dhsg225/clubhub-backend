/**
 * Pre-runtime main loop.
 *
 * Runs on the Pi device:
 * - Loads corpus from local store (fallback-safe)
 * - WebSocket server on WS_PORT for player-ui
 * - PRE.resolve() loop at CORPUS_SYNC_INTERVAL_MS
 * - Audit batch flush at AUDIT_BATCH_INTERVAL_MS
 *
 * Constitutional constraints:
 * - Emergency overlay cannot be suppressed by resolve() output
 * - Corpus sync failure falls back to last-known-good corpus
 * - Audit flush failure queues records — never drops
 */
import { WebSocketServer, type WebSocket } from 'ws';
import { resolve } from '@clubhub/pre-engine';
import { emit, base } from '@clubhub/telemetry-sdk';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from './config.js';
import { CorpusStore } from './corpus-store.js';
import { HeartbeatEmitter } from './heartbeat.js';
import { AuditBuffer } from './audit-buffer.js';
import { buildPREInput } from './corpus-mapper.js';

export async function startRuntime(): Promise<void> {
  const config = loadConfig();
  const dataDir = process.env['DATA_DIR'] ?? path.join(os.tmpdir(), 'pre-runtime');

  // ── Corpus store ──────────────────────────────────────────────────────────
  const corpusStore = new CorpusStore(dataDir);
  await corpusStore.load();

  // ── Audit buffer ─────────────────────────────────────────────────────────
  const auditBuffer = new AuditBuffer(dataDir);

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  const heartbeat = new HeartbeatEmitter();
  heartbeat.start(30_000, config.SCREEN_ID, config.VENUE_ID);

  // ── WebSocket server ──────────────────────────────────────────────────────
  const wss = new WebSocketServer({ port: config.WS_PORT });

  wss.on('listening', () => {
    emit({
      ...base('INFO', 'pre_runtime.ws_started'),
      port: config.WS_PORT,
    } as Parameters<typeof emit>[0]);
  });

  wss.on('connection', (ws: WebSocket) => {
    emit({
      ...base('INFO', 'pre_runtime.ws_client_connected'),
      clients: wss.clients.size,
    } as Parameters<typeof emit>[0]);

    ws.on('close', () => {
      emit({
        ...base('INFO', 'pre_runtime.ws_client_disconnected'),
        clients: wss.clients.size,
      } as Parameters<typeof emit>[0]);
    });
  });

  let lastResolveAt: number | null = null;

  // ── PRE.resolve() loop ────────────────────────────────────────────────────
  const resolveLoop = setInterval(() => {
    const corpus = corpusStore.getCurrent();
    if (!corpus) {
      emit({
        ...base('WARN', 'pre_runtime.no_corpus'),
        screen_id: config.SCREEN_ID,
      } as Parameters<typeof emit>[0]);
      return;
    }

    try {
      const preInput = buildPREInput(corpus, config.SCREEN_ID, config.VENUE_ID, Date.now());
      const output = resolve(preInput);
      lastResolveAt = Date.now();

      // Push PLAYLIST_UPDATE to all connected WebSocket clients
      const message = JSON.stringify({ type: 'PLAYLIST_UPDATE', payload: output });
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === 1 /* OPEN */) {
          client.send(message);
        }
      });

      // Buffer audit record (append-only — never drops)
      auditBuffer.append({
        screen_id: config.SCREEN_ID,
        venue_id: config.VENUE_ID,
        at: preInput.at,
        resolution_level: output.resolution_level,
        is_fallback: output.is_fallback,
        playlist_checksum: output.playlist_checksum,
      });

      emit({
        ...base('INFO', 'pre_runtime.resolve_complete'),
        resolution_level: output.resolution_level,
        is_fallback: output.is_fallback,
        playlist_checksum: output.playlist_checksum,
      } as Parameters<typeof emit>[0]);
    } catch (err: unknown) {
      emit({
        ...base('ERROR', 'pre_runtime.resolve_error'),
        error: String(err),
      } as Parameters<typeof emit>[0]);
    }
  }, config.CORPUS_SYNC_INTERVAL_MS);

  // ── Audit batch flush loop ────────────────────────────────────────────────
  const flushLoop = setInterval(async () => {
    const records = await auditBuffer.readAll();
    if (records.length === 0) return;

    try {
      // TODO Wave 5: POST records to replay-service endpoint
      emit({
        ...base('INFO', 'pre_runtime.audit_flush'),
        record_count: records.length,
      } as Parameters<typeof emit>[0]);
    } catch (err: unknown) {
      emit({
        ...base('ERROR', 'pre_runtime.audit_flush_error'),
        error: String(err),
      } as Parameters<typeof emit>[0]);
    }
  }, config.AUDIT_BATCH_INTERVAL_MS);

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = () => {
    clearInterval(resolveLoop);
    clearInterval(flushLoop);
    heartbeat.stop();
    wss.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  emit({
    ...base('INFO', 'pre_runtime.started'),
    screen_id: config.SCREEN_ID,
    venue_id: config.VENUE_ID,
    ws_port: config.WS_PORT,
    last_resolve_at: lastResolveAt,
  } as Parameters<typeof emit>[0]);
}
