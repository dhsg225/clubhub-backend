require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { waitForDb } = require('./db');
const log = require('./lib/logger');

const requestId     = require('./middleware/requestId');
const { rateLimit } = require('./middleware/rateLimiter');
const timeout       = require('./middleware/timeout');
const screenAuth    = require('./middleware/screenAuth');
const { injectTenantContext, loadDefaultTenantId } = require('./middleware/tenantContext');

const healthRouter    = require('./routes/health');
const contentRouter   = require('./routes/content');
const manifestRouter  = require('./routes/manifest');
const playlistRouter  = require('./routes/playlist');
const assetsRouter    = require('./routes/assets');
const venuesRouter    = require('./routes/venues');
const screensRouter   = require('./routes/screens');
const schedulesRouter = require('./routes/schedules');
const resolveRouter        = require('./routes/resolve');
const otaRouter            = require('./routes/ota');
const namedPlaylistsRouter = require('./routes/named-playlists');
const tickerRouter         = require('./routes/ticker');
const tenantsRouter        = require('./routes/tenants');
const sponsorRouter        = require('./routes/sponsor');
const cardTemplatesRouter  = require('./routes/card-templates');
const mediaRouter          = require('./routes/media');
const aiRouter             = require('./routes/ai');
const layoutsRouter        = require('./routes/layouts');

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(requestId);             // attach req.requestId to every request
app.use(timeout(10_000));       // kill stalled requests after 10 s

// Trust proxy headers (needed when running behind nginx/caddy)
app.set('trust proxy', 1);

app.use(cors());

// Payload size limits — reject oversized bodies before they reach route handlers
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

app.use('/uploads', express.static(UPLOAD_DIR));

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    log.info('http.request', {
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      duration_ms: Date.now() - t0,
      req_id:     req.requestId,
      ip:         req.ip,
    });
  });
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Health endpoints are not rate-limited (liveness/readiness probes need free access)
app.use('/health', healthRouter);

// Manifest reads: generous limit — 10 screens × 4 req/min = 40 req/min expected
app.use('/manifest',  rateLimit(120, 60_000), screenAuth.requireScreenToken, manifestRouter);
app.use('/resolve',   rateLimit(120, 60_000), resolveRouter);

// For browser navigation to API paths, serve the SPA instead of JSON.
// API calls always carry X-Correlation-Id (set by api-client.ts);
// direct browser navigation never does.
const serveSpaForBrowser = (req, res, next) => {
  if (!req.headers['x-correlation-id']) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
};

// Write endpoints: moderate limit
app.use('/content',   serveSpaForBrowser, rateLimit.write, injectTenantContext, contentRouter);
app.use('/schedules', serveSpaForBrowser, rateLimit.write, injectTenantContext, schedulesRouter);
app.use('/venues',    serveSpaForBrowser, rateLimit.write, injectTenantContext, venuesRouter);
app.use('/screens',   serveSpaForBrowser, rateLimit.write, injectTenantContext, screensRouter);

// OTA delivery — operator API + Pi polling
app.use('/ota',       rateLimit.heavy, otaRouter);

// Named playlists (operator-authored playlist groups)
app.use('/named_playlists', serveSpaForBrowser, rateLimit.write, injectTenantContext, namedPlaylistsRouter);

// Ticker items (operator-authored scrolling text)
app.use('/ticker', serveSpaForBrowser, rateLimit.write, injectTenantContext, tickerRouter);

// Tenant admin (BL-036)
app.use('/tenants', serveSpaForBrowser, rateLimit.write, tenantsRouter);

// Sponsor ingest (BL-037)
app.use('/sponsor', rateLimit.write, injectTenantContext, sponsorRouter);

// Card template catalogue (BL-040 / D-019 L2)
// GET is public (tenant-scoped via injectTenantContext); POST is admin-only (guarded in router)
app.use('/card-templates', serveSpaForBrowser, rateLimit.write, injectTenantContext, cardTemplatesRouter);

// Media upload tokens (BL-041 — direct browser→Bunny upload)
app.use('/media', rateLimit.write, injectTenantContext, mediaRouter);

// AI generation via Cognito bridge (BL-047)
app.use('/ai', serveSpaForBrowser, rateLimit.write, injectTenantContext, aiRouter);

// Layout catalogue (BL-048)
app.use('/layouts', serveSpaForBrowser, rateLimit.write, layoutsRouter);

// Less frequent / legacy
app.use('/playlist',  rateLimit.write, playlistRouter);
app.use('/asset',     rateLimit.write, assetsRouter);

// ── Frontend (CMS web app) ─────────────────────────────────────────────────────
// Serve static assets first (JS/CSS bundles, index.html at root).
app.use(express.static(path.join(__dirname, '../public')));

// SPA catch-all: serve index.html for browser navigation to any unknown path.
// API calls always carry X-Correlation-Id (set by api-client.ts); browser
// navigation never does. This lets /venues, /screens etc. work as both
// API endpoints (when called by the app) and frontend routes (when typed directly).
app.get('*', (req, res) => {
  if (req.headers['x-correlation-id']) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Unhandled error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  log.error('http.unhandled_error', {
    error:  err.message,
    req_id: req.requestId,
    path:   req.path,
  });
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function start() {
  await waitForDb();

  // Load default tenant UUID before routes mount (D-018)
  await loadDefaultTenantId();

  // ── Governance DB init (before app.listen) ──────────────────────────────────
  const { pool }       = require('./db');
  const governanceDb   = require('./lib/governance-db');
  const fleetConsensus = require('./lib/fleet-consensus');
  const operatorLedger = require('./lib/operator-ledger');
  const incidentOrch   = require('./lib/incident-orchestrator');
  const governedConfig = require('./lib/governed-config');
  const { GovernedConfig, setInstance: setGovConfigInstance } = governedConfig;

  // Bootstrap governed-config singleton ONCE from thresholds.json before DB init.
  // This is the ONLY permitted direct thresholds.json read; all other modules
  // must call getThreshold() / getThresholdSnapshot() from governed-config.
  let _bootstrapThresholds = {};
  try {
    _bootstrapThresholds = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../../test-config/thresholds.json'), 'utf8'
    ));
  } catch { /* use empty defaults */ }
  const govConfigInstance = new GovernedConfig(_bootstrapThresholds, null);
  setGovConfigInstance(govConfigInstance);

  await governanceDb.initSchema(pool);

  fleetConsensus.setPool(pool);
  operatorLedger.setPool(pool);

  await fleetConsensus.initFromDb(pool);
  await operatorLedger.initFromDb(pool);

  try { await incidentOrch.initFromDb?.(pool); } catch { /* optional */ }

  const operatorSessions = require('./lib/operator-sessions');
  operatorSessions.setPool(pool);
  try { await operatorSessions.initFromDb(pool); } catch { /* optional */ }
  govConfigInstance.setPool(pool);
  try { await govConfigInstance.initFromDb(pool); } catch { /* optional */ }

  // BL-038: start social cross-posting worker
  const { startSocialWorker } = require('./lib/social-worker');
  startSocialWorker();

  app.listen(PORT, async () => {
    const { emit, EVENTS } = require('./lib/events');

    // Emit structured startup event
    emit(EVENTS.PLATFORM.STARTUP, null, {
      port:         PORT,
      node_version: process.version,
      db_connected: true,
    });

    // Increment fleet consensus epoch on every backend startup.
    // ACTIVE/ACTIVE SAFE: awaited — uses atomic DB increment and reads back the
    // authoritative value. Memory is set to the DB-returned epoch. All instances
    // in a cluster share the same DB counter; each startup increments it exactly once.
    // If this fails the server cannot serve manifests from a known epoch — exit.
    try {
      await fleetConsensus.incrementEpoch();
    } catch (err) {
      log.error('startup.epoch_increment_failed', { error: err.message });
      process.exit(1);
    }

    // Load active rollout state on startup (crash-safe: just log if none)
    try {
      const { RolloutStore } = require('./lib/rollout-store');
      const { snapshot: thresholds } = governedConfig.getThresholdSnapshot();
      const active = await RolloutStore.loadActive(require('./db').pool, thresholds);
      if (active) {
        log.info('ota.rollout_restored', { update_id: active.updateId, state: active.state });
      }
    } catch (err) {
      log.warn('ota.rollout_restore_failed', { error: err.message });
    }

    // Wire Loki sink if configured
    if (process.env.LOKI_URL) {
      const { LokiSink }     = require('./lib/sinks/loki');
      const { registerSink } = require('./lib/events');
      registerSink(new LokiSink());
      log.info('observability.loki_sink_registered', { url: process.env.LOKI_URL });
    }
  });
}

start().catch((err) => {
  log.error('server.start_failed', { error: err.message });
  process.exit(1);
});
