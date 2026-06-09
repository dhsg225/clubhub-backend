/**
 * Player runtime entry point.
 *
 * Reads config from environment, initializes orchestrator, handles signals.
 */
import { PlayerOrchestrator } from './orchestrator.js';
import { ChromiumLauncher } from './chromium-launcher.js';
import { UiServer } from './ui-server.js';
import type { PlayerConfig } from './types.js';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

const config: PlayerConfig = {
  screen_id: requireEnv('SCREEN_ID'),
  venue_id: requireEnv('VENUE_ID'),
  poll_interval_ms: parseInt(process.env['CORPUS_POLL_INTERVAL_MS'] ?? '60000', 10),
  heartbeat_interval_ms: parseInt(process.env['HEARTBEAT_INTERVAL_MS'] ?? '30000', 10),
  corpus_cache_dir: process.env['CORPUS_CACHE_DIR'] ?? '/var/clubhub/corpus',
  replay_cache_dir: process.env['REPLAY_CACHE_DIR'] ?? '/var/clubhub/replay',
  asset_dir: process.env['ASSET_DIR'] ?? '/var/clubhub/assets',
  chromium_url: process.env['CHROMIUM_URL'] ?? 'http://localhost:3001',
  websocket_port: parseInt(process.env['WEBSOCKET_PORT'] ?? '7777', 10),
  cms_api_url: process.env['CMS_API_URL'] ?? '',
  autonomous_window_ms: 72 * 60 * 60 * 1000, // 72h — constitutional requirement
};

async function main(): Promise<void> {
  console.log(`[player-runtime] Starting — screen_id=${config.screen_id}`);

  const orchestrator = new PlayerOrchestrator(config);
  const chromium = new ChromiumLauncher(config.chromium_url);
  const uiServer = new UiServer(
    process.env['PLAYER_UI_DIR'] ?? '/opt/clubhub/player-ui',
    3001,
    config.asset_dir,
  );

  // Wire Chromium launcher into orchestrator BEFORE start so the first
  // syncHealthFromWatchdog() call already has a PID to probe.
  orchestrator.setChromiumLauncher(chromium);

  // Serve player-ui static files, then start Chromium
  uiServer.start();
  chromium.start();

  // Start orchestrator
  await orchestrator.start();

  // Handle shutdown signals
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[player-runtime] Received ${signal} — shutting down`);
    chromium.stop();
    uiServer.stop();
    await orchestrator.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((err: unknown) => {
  console.error('[player-runtime] Fatal error:', err);
  process.exit(1);
});
