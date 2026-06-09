# Player Runtime Implementation Plan

**Surface:** Raspberry Pi edge player — two-process model
**Hardware targets:** GRADE_A (Pi 4GB RAM, 64GB storage, GPIO emergency button, 4G backup), GRADE_B (standard Pi 4, 32GB)
**Status:** Implementation-ready engineering specification

---

## 1. Architecture Overview: Two-Process Model

The player runs two processes that communicate exclusively via a local WebSocket. This separation is deliberate and must not be collapsed.

```
┌─────────────────────────────────────────────────────────┐
│  Process 1: player-runtime (Node.js)                    │
│                                                         │
│  - PRE.resolve() loop                                   │
│  - Corpus management (local verified store)             │
│  - Audit buffer (append-only NDJSON)                    │
│  - CMS sync (corpus version check + download)           │
│  - Asset prefetch                                       │
│  - Entropy metric emission                              │
│  - Circuit breakers (PRE, Replay, Global)               │
│  - Local WebSocket server (ws://localhost:7777)         │
└────────────────┬────────────────────────────────────────┘
                 │  WebSocket (local only)
┌────────────────▼────────────────────────────────────────┐
│  Process 2: player-ui (Chromium kiosk)                  │
│                                                         │
│  - Renders resolved playlist from player-runtime        │
│  - Renders emergency overlay when signaled              │
│  - No CMS access, no internet access                    │
│  - Reads assets from local filesystem only              │
└─────────────────────────────────────────────────────────┘
```

**Why two processes:**
- Chromium kiosk crashes and GPU resets must not interrupt audit buffering or corpus management
- If player-ui crashes, player-runtime continues buffering audit records — no gap
- If player-runtime crashes, player-ui serves the last known playlist from memory until reconnect
- Security boundary: Chromium never touches the CMS API or corpus files directly

---

## 2. Process 1: player-runtime

### 2.1 Directory Structure

```
player-runtime/
  src/
    index.ts                  -- entry point, process lifecycle
    core/
      resolve-loop.ts         -- main 30s resolve cycle
      corpus-manager.ts       -- local corpus load/verify/apply
      asset-prefetcher.ts     -- prefetch assets referenced in resolved playlist
    audit/
      audit-buffer.ts         -- append-only NDJSON writer
      audit-flusher.ts        -- batch POST to CMS, truncate on success
    sync/
      corpus-sync.ts          -- version check + download + verify
      emergency-channel.ts    -- WebSocket to CMS emergency endpoint
    circuit-breakers/
      -- imports from shared src/runtime/circuit-breakers/ (existing)
    entropy/
      entropy-emitter.ts      -- compute + POST entropy metrics
    ws/
      local-ws-server.ts      -- WebSocket server for player-ui
      message-types.ts        -- typed message definitions
    config/
      player-config.ts        -- configuration schema + load
```

### 2.2 Core Resolve Loop

The resolve loop is the heartbeat of player-runtime. Interval: 30 seconds (configurable via `RESOLVE_INTERVAL_MS`).

```typescript
// core/resolve-loop.ts

async function resolveLoop(deps: ResolveDeps): Promise<void> {
  const at = Date.now();

  // 1. Check GlobalConstitutionalBreaker state first
  const globalState = deps.globalBreaker.getState();
  if (globalState.mode === 'EMERGENCY_FREEZE') {
    // Do NOT call PRE.resolve(). Send freeze signal to player-ui.
    deps.wsServer.broadcast({ type: 'CONSTITUTIONAL_STATE', state: 'EMERGENCY_FREEZE' });
    return;
  }

  // 2. Attempt PRE.resolve()
  let result: PREResult;
  try {
    result = await deps.preBreaker.call(() =>
      resolve({
        corpus: deps.corpusManager.getCurrent(),
        screenId: deps.config.screenId,
        at,
      })
    );
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      // PRECircuitBreaker is open — enter fallback mode
      deps.wsServer.broadcast({ type: 'FALLBACK_MODE', reason: 'PRE_CIRCUIT_OPEN' });
      return;
    }
    throw err;
  }

  // 3. Emit ReplayAuditRecord to local buffer
  const record: ReplayAuditRecord = {
    screen_id: deps.config.screenId,
    at,
    input_hash: computeInputHash(deps.corpusManager.getCurrent(), at),
    output_hash: result.playlist_checksum,
    resolution_level: result.resolution_level,
    trace: result.trace,
  };
  await deps.auditBuffer.append(record);

  // 4. Prefetch assets referenced in resolved playlist
  await deps.assetPrefetcher.ensureAvailable(result.playlist);

  // 5. Send resolved playlist to player-ui
  deps.wsServer.broadcast({
    type: 'PLAYLIST_UPDATE',
    playlist: result.playlist,
    checksum: result.playlist_checksum,
    resolution_level: result.resolution_level,
    at,
  });
}
```

**Resolve loop error handling:**
- If `resolve()` throws a non-CircuitBreaker error: record failure in PRECircuitBreaker, log error, skip this cycle — do not crash the process
- If resolve loop fails 3+ consecutive times: PRECircuitBreaker opens, player-runtime enters fallback mode
- In fallback mode: player-ui continues with last known playlist; player-runtime still syncs corpus and flushes audit buffer

### 2.3 Corpus Management

```typescript
// core/corpus-manager.ts

class CorpusManager {
  private current: Corpus | null = null;
  private currentVersion: string | null = null;
  private readonly corpusPath: string;
  private readonly tempPath: string;

  async initialize(): Promise<void> {
    // Load from local verified file on startup
    if (await fileExists(this.corpusPath)) {
      const raw = await fs.readFile(this.corpusPath, 'utf8');
      const parsed = JSON.parse(raw);
      await this.verify(parsed);
      this.current = parsed.corpus;
      this.currentVersion = parsed.version;
    } else {
      // No local corpus — must download
      await this.downloadAndApply();
    }
  }

  async checkForUpdate(): Promise<void> {
    const remote = await fetchCorpusVersion(); // GET /corpus/version
    if (remote.version === this.currentVersion) return;

    // Download new corpus
    const downloaded = await downloadCorpus(remote.version); // GET /corpus/:version
    await this.verify(downloaded);
    await this.atomicApply(downloaded);
  }

  private async atomicApply(corpus: DownloadedCorpus): Promise<void> {
    // Write to temp file first
    await fs.writeFile(this.tempPath, JSON.stringify(corpus));
    // Verify temp file is readable and valid
    const verification = await this.verify(JSON.parse(await fs.readFile(this.tempPath, 'utf8')));
    if (!verification.valid) {
      // Reject — do not apply
      await fs.unlink(this.tempPath);
      throw new CorpusVerificationError(verification.reason);
    }
    // Rename: atomic on Linux (same filesystem)
    await fs.rename(this.tempPath, this.corpusPath);
    this.current = corpus.corpus;
    this.currentVersion = corpus.version;
  }

  private async verify(corpus: unknown): Promise<VerificationResult> {
    // Verify checksum matches corpus content
    const computed = computeCorpusChecksum(corpus);
    const expected = (corpus as any).checksum;
    return { valid: computed === expected, reason: computed !== expected ? 'checksum_mismatch' : null };
  }

  getCurrent(): Corpus {
    if (!this.current) throw new Error('Corpus not initialized');
    return this.current;
  }
}
```

**Corpus management invariants:**
- Never apply a corpus whose checksum does not verify — continue with previous corpus, alert CMS
- Never partially apply a corpus — the rename operation is atomic on the same filesystem
- The corpus file on disk always reflects a complete, verified corpus version
- Corpus version: check every 5 minutes (configurable via `CORPUS_SYNC_INTERVAL_MS`)

### 2.4 Audit Buffer

The audit buffer is an append-only NDJSON file. One ReplayAuditRecord per line.

```typescript
// audit/audit-buffer.ts

class AuditBuffer {
  private readonly bufferPath: string;
  private readonly maxSizeBytes: number = 50 * 1024 * 1024; // 50MB

  async append(record: ReplayAuditRecord): Promise<void> {
    const line = JSON.stringify(record) + '\n';
    await fs.appendFile(this.bufferPath, line);
    await this.checkBufferSize();
  }

  private async checkBufferSize(): Promise<void> {
    const stat = await fs.stat(this.bufferPath);
    if (stat.size > this.maxSizeBytes) {
      // Alert: buffer is too large — CMS sync problem
      logger.warn('AUDIT_BUFFER_OVERFLOW', {
        size_bytes: stat.size,
        threshold_bytes: this.maxSizeBytes,
      });
      // Do NOT truncate — preserve records. The CMS sync issue must be fixed.
      // Alerting mechanism: POST /device/alert (fire-and-forget)
    }
  }

  async readBatch(maxRecords: number = 1000): Promise<{ records: ReplayAuditRecord[]; lineCount: number }> {
    const content = await fs.readFile(this.bufferPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const batch = lines.slice(0, maxRecords).map(l => JSON.parse(l));
    return { records: batch, lineCount: Math.min(lines.length, maxRecords) };
  }

  async truncateDelivered(lineCount: number): Promise<void> {
    // Remove the first lineCount lines from the buffer
    const content = await fs.readFile(this.bufferPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const remaining = lines.slice(lineCount).join('\n') + (lines.length > lineCount ? '\n' : '');
    await fs.writeFile(this.bufferPath, remaining);
  }
}
```

**Audit flusher — POST /audit/batch every 15 minutes:**

```typescript
// audit/audit-flusher.ts

async function flushAuditBatch(buffer: AuditBuffer, config: Config): Promise<void> {
  const { records, lineCount } = await buffer.readBatch(1000);
  if (records.length === 0) return;

  const response = await fetch(`${config.cmsBaseUrl}/api/v2/audit/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.deviceToken}` },
    body: JSON.stringify({ records, screen_id: config.screenId }),
  });

  if (!response.ok) {
    logger.error('AUDIT_FLUSH_FAILED', { status: response.status });
    return; // Do not truncate — retry next cycle
  }

  // Only truncate after confirmed delivery
  await buffer.truncateDelivered(lineCount);
}
```

Buffer overflow behavior: if the buffer reaches 50MB, emit an alert to CMS but do NOT drop records. Dropping audit records is constitutionally impermissible — the device should alert the operator that CMS sync is broken.

### 2.5 Emergency Channel

The emergency channel maintains a WebSocket connection to the CMS emergency endpoint. It falls back to 30-second long-polling if the WebSocket drops.

```typescript
// sync/emergency-channel.ts

class EmergencyChannel {
  private ws: WebSocket | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastEmergencyState: EmergencyState | null = null;

  async connect(config: Config, onEmergency: EmergencyHandler): Promise<void> {
    this.establishWebSocket(config, onEmergency);
  }

  private establishWebSocket(config: Config, onEmergency: EmergencyHandler): void {
    const ws = new WebSocket(`${config.cmsWsUrl}/ws/emergency?screen_id=${config.screenId}`);
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'EMERGENCY_ACTIVE') {
        this.lastEmergencyState = msg;
        onEmergency({ active: true, content: msg.emergency_content });
      } else if (msg.type === 'EMERGENCY_CLEARED') {
        this.lastEmergencyState = null;
        onEmergency({ active: false });
      }
    });
    ws.on('close', () => {
      // WebSocket dropped — fall back to long polling
      this.startLongPoll(config, onEmergency);
    });
    this.ws = ws;
  }

  private startLongPoll(config: Config, onEmergency: EmergencyHandler): void {
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${config.cmsBaseUrl}/api/v2/emergency/status?screen_id=${config.screenId}`);
        const state = await res.json();
        if (state.active && !this.lastEmergencyState) {
          onEmergency({ active: true, content: state.emergency_content });
        } else if (!state.active && this.lastEmergencyState) {
          this.lastEmergencyState = null;
          onEmergency({ active: false });
        }
      } catch (err) {
        logger.warn('EMERGENCY_POLL_FAILED', { err });
      }
    }, 30_000);
  }
}
```

When `onEmergency` fires with `active: true`, player-runtime immediately broadcasts to player-ui:

```typescript
wsServer.broadcast({
  type: 'EMERGENCY_ACTIVE',
  content: emergencyContent,
  // emergency_content: pre-positioned asset path on local filesystem
});
```

### 2.6 Circuit Breakers in player-runtime

The circuit breakers from `src/runtime/circuit-breakers/` run inside player-runtime.

```typescript
// Entry point wiring
const preBreaker = new PRECircuitBreaker();          // threshold=3, recovery_probe_ms=30_000
const replayBreaker = new ReplayCircuitBreaker();    // threshold=1 → immediate CLASS_4
const globalBreaker = new GlobalConstitutionalBreaker(); // NORMAL/READ_ONLY/EMERGENCY_FREEZE

// If replayBreaker opens (any replay nondeterminism):
replayBreaker.on('open', () => {
  globalBreaker.transitionTo('EMERGENCY_FREEZE', 'REPLAY_NONDETERMINISM');
  wsServer.broadcast({ type: 'CONSTITUTIONAL_STATE', state: 'EMERGENCY_FREEZE', reason: 'REPLAY_NONDETERMINISM' });
  // Stop resolve loop — do not call resolve() again until PLATFORM_ADMIN resets
  resolveLoopEnabled = false;
});

// GlobalConstitutionalBreaker.reset() requires human_authorization_token
// The CMS pushes a reset command via the constitutional WebSocket channel after PLATFORM_ADMIN action
```

**Critical: when `EMERGENCY_FREEZE` is active in player-runtime:**
- Resolve loop stops
- player-ui shows the last known playlist (it does not show a blank screen)
- player-ui also shows the emergency state overlay
- Audit buffer flushing continues — records must not be lost during freeze
- Corpus sync continues checking but will not apply new corpus until state clears

### 2.7 Entropy Emission

```typescript
// entropy/entropy-emitter.ts

async function emitEntropyMetrics(config: Config, corpusManager: CorpusManager): Promise<void> {
  const metrics = await computeEntropyMetrics({
    screenId: config.screenId,
    corpus: corpusManager.getCurrent(),
    localAssetManifest: await getLocalAssetManifest(),
  });

  await fetch(`${config.cmsBaseUrl}/api/v2/entropy/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.deviceToken}` },
    body: JSON.stringify(metrics),
  });
}
```

Emission interval: every 10 minutes (configurable via `ENTROPY_EMIT_INTERVAL_MS`).

---

## 3. Process 2: player-ui

### 3.1 Technology Decision: Vanilla JS + HTML (not React)

**Rationale:** A React build on a Raspberry Pi runs acceptably in Chromium, but introduces a JavaScript bundle that needs to be updated via OTA alongside the Chromium process. Vanilla JS with minimal dependencies means:

- The player-ui HTML/JS is a single static file, not a build artifact
- No Node.js in the browser process
- Simpler crash recovery (Chromium restarts load the same static file)
- Smaller memory footprint on constrained hardware

The player-ui is not a product surface — it is a rendering engine for the resolved playlist. The complexity lives in player-runtime, not in what Chromium runs.

### 3.2 Chromium Launch Command

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --no-first-run \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-background-networking \
  --disable-default-apps \
  --disable-extensions \
  --disable-sync \
  --no-sandbox \
  --app=file:///opt/clubhub-player/ui/index.html
```

`--no-sandbox` required on Pi for GPU access. The security model is: player-ui has no network access, reads only local files, and communicates only on localhost WebSocket.

**Firewall rule (applied at OS level, not by Chromium):**
```
iptables -A OUTPUT -m owner --uid-owner chromium -d 127.0.0.1 -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner chromium -j DROP
```

This enforces that Chromium cannot reach the CMS or internet directly regardless of what the JS executes.

### 3.3 player-ui Structure

```
ui/
  index.html
  player.js       -- all UI logic, single file
  assets/
    emergency-fallback.html   -- static fallback if player.js fails entirely
```

### 3.4 WebSocket Connection to player-runtime

```javascript
// player.js

const WS_URL = 'ws://localhost:7777';
let ws = null;
let lastKnownPlaylist = null;
let reconnectTimeout = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = function() {
    // Continue rendering lastKnownPlaylist — do not blank screen
    scheduleReconnect();
  };

  ws.onerror = function() {
    // Log to console (player-runtime reads Chromium stdout in debug mode)
    console.error('[player-ui] WebSocket error');
  };
}

function scheduleReconnect() {
  // Backoff: 1s, 2s, 4s, 8s, max 30s
  const delay = Math.min(reconnectAttempt * 1000, 30_000);
  reconnectTimeout = setTimeout(() => {
    reconnectAttempt++;
    connect();
  }, delay);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'PLAYLIST_UPDATE':
      lastKnownPlaylist = msg.playlist;
      startPlaylist(msg.playlist);
      break;
    case 'EMERGENCY_ACTIVE':
      showEmergencyOverlay(msg.content);
      break;
    case 'EMERGENCY_CLEARED':
      hideEmergencyOverlay();
      break;
    case 'CONSTITUTIONAL_STATE':
      handleConstitutionalState(msg.state, msg.reason);
      break;
    case 'FALLBACK_MODE':
      // Continue rendering lastKnownPlaylist — no visual change needed
      console.warn('[player-ui] Fallback mode:', msg.reason);
      break;
    default:
      console.warn('[player-ui] Unknown message type:', msg.type);
  }
}
```

### 3.5 Playlist Renderer

```javascript
// Playlist item sequence

let currentItemIndex = 0;
let playTimer = null;

function startPlaylist(playlist) {
  clearTimeout(playTimer);
  currentItemIndex = 0;
  playItem(playlist);
}

function playItem(playlist) {
  if (!playlist || playlist.length === 0) return;
  const item = playlist[currentItemIndex % playlist.length];

  renderItem(item);

  playTimer = setTimeout(() => {
    currentItemIndex++;
    playItem(playlist);
  }, item.duration_ms);
}

function renderItem(item) {
  const container = document.getElementById('content');

  // Determine asset path — always local filesystem
  const assetPath = `/opt/clubhub-player/assets/${item.content_id}`;

  if (item.content_type === 'image') {
    container.innerHTML = `<img src="${assetPath}" class="fullscreen-asset" onerror="handleAssetError(this)">`;
  } else if (item.content_type === 'video') {
    container.innerHTML = `<video src="${assetPath}" class="fullscreen-asset" autoplay muted onended="onVideoEnd()" onerror="handleAssetError(this)"></video>`;
  }
}

function handleAssetError(el) {
  // Asset not available locally — skip to next item
  console.warn('[player-ui] Asset not available:', el.src);
  currentItemIndex++;
  playItem(lastKnownPlaylist);
  // Do NOT crash. Do NOT show error state.
}
```

**Asset loading rules:**
- All assets are loaded from local filesystem (`/opt/clubhub-player/assets/`)
- If an asset file is not present: log a warning, skip to next item in playlist
- Never request assets from the network (Chromium is firewalled)
- player-runtime is responsible for prefetching assets before they are needed

### 3.6 Emergency Overlay

```javascript
function showEmergencyOverlay(content) {
  const overlay = document.getElementById('emergency-overlay');
  const assetPath = `/opt/clubhub-player/assets/${content.asset_id}`;

  if (content.type === 'image') {
    overlay.innerHTML = `<img src="${assetPath}" class="fullscreen-asset">`;
  } else if (content.type === 'video') {
    overlay.innerHTML = `<video src="${assetPath}" class="fullscreen-asset" autoplay loop muted></video>`;
  } else if (content.type === 'text') {
    overlay.innerHTML = `<div class="emergency-text">${escapeHtml(content.text)}</div>`;
  }

  overlay.classList.remove('hidden');
}

function hideEmergencyOverlay() {
  document.getElementById('emergency-overlay').classList.add('hidden');
}
```

Emergency overlay CSS:

```css
#emergency-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999;
  background: #7f1d1d; /* fallback if asset not available */
}
#emergency-overlay.hidden {
  display: none;
}
```

The emergency overlay cannot be overridden by playlist rendering. Its z-index is above all content.

**Emergency asset pre-positioning:** The emergency content asset must be verified as present on all screens before any venue goes live. player-runtime checks for emergency asset presence on startup and reports to CMS if missing. This is a production prerequisite documented in the operational runbooks.

### 3.7 Constitutional State in player-ui

```javascript
function handleConstitutionalState(state, reason) {
  switch (state) {
    case 'EMERGENCY_FREEZE':
      // Show a state banner below any active playlist (playlist stays visible)
      showConstitutionalBanner('EMERGENCY FREEZE', reason);
      break;
    case 'DEGRADED':
    case 'CONSTITUTIONAL_RISK':
      // These are player-runtime concerns — player-ui continues rendering
      // No visual change in player-ui for these states
      break;
    case 'HEALTHY':
      hideConstitutionalBanner();
      break;
  }
}

function showConstitutionalBanner(state, reason) {
  const banner = document.getElementById('constitutional-banner');
  banner.textContent = `${state}: ${reason}`;
  banner.classList.remove('hidden');
}
```

The constitutional banner in player-ui is informational only. It appears as a footer bar below the content area. It does not affect content rendering.

### 3.8 Offline Behavior

**If WebSocket to player-runtime disconnects:**
1. Continue rendering `lastKnownPlaylist` until reconnect
2. No error screen shown to viewers
3. Schedule WebSocket reconnect with backoff

**If player-runtime process crashes:**
1. Chromium detects WebSocket close
2. Continues rendering `lastKnownPlaylist`
3. Chromium's static fallback page shows after `lastKnownPlaylist` is gone from memory (Chromium restart)
4. systemd restarts player-runtime — it reconnects to Chromium's WebSocket

**Chromium crash (GPU, OOM):**
1. systemd restarts Chromium
2. On restart: Chromium loads `index.html`
3. `index.html` connects to player-runtime WebSocket
4. player-runtime sends current playlist on connection

---

## 4. Process Management (systemd)

```ini
# /etc/systemd/system/clubhub-player-runtime.service
[Unit]
Description=ClubHub Player Runtime
After=network.target

[Service]
Type=simple
User=clubhub
WorkingDirectory=/opt/clubhub-player
ExecStart=/usr/bin/node /opt/clubhub-player/runtime/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/clubhub-player-ui.service
[Unit]
Description=ClubHub Player UI (Chromium kiosk)
After=clubhub-player-runtime.service graphical.target
Requires=clubhub-player-runtime.service

[Service]
Type=simple
User=chromium
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs --no-first-run \
  --disable-infobars --disable-session-crashed-bubble \
  --app=file:///opt/clubhub-player/ui/index.html
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
```

player-runtime starts before player-ui. If player-runtime is not running when player-ui connects, player-ui shows the static fallback page and retries connection.

---

## 5. Configuration

```typescript
// config/player-config.ts

type PlayerConfig = {
  screenId: string;                   // stable logical identifier (not hardware_id)
  deviceToken: string;                // auth token for CMS API
  cmsBaseUrl: string;                 // https://cms.clubhub.tv
  cmsWsUrl: string;                   // wss://cms.clubhub.tv
  resolveIntervalMs: number;          // default: 30_000
  corpusSyncIntervalMs: number;       // default: 300_000 (5 min)
  auditFlushIntervalMs: number;       // default: 900_000 (15 min)
  entropyEmitIntervalMs: number;      // default: 600_000 (10 min)
  corpusPath: string;                 // /opt/clubhub-player/corpus/corpus.json
  auditBufferPath: string;            // /opt/clubhub-player/audit/buffer.ndjson
  assetDirectory: string;             // /opt/clubhub-player/assets/
  maxAuditBufferBytes: number;        // default: 52_428_800 (50MB)
  localWsPort: number;                // default: 7777
};
```

Configuration is loaded from `/opt/clubhub-player/config/player.json` at startup. Required fields: `screenId`, `deviceToken`, `cmsBaseUrl`. All others have defaults.

The `screenId` is set during device enrollment and must match the `screen_id` in the corpus. `hardware_id` (MAC address or serial) is used only for device management during enrollment — it never enters PRE.resolve().

---

## 6. GPIO Emergency Button (GRADE_A Venues)

```typescript
// Only active if ENABLE_GPIO_EMERGENCY=true in config

import { Gpio } from 'onoff';

const emergencyButton = new Gpio(17, 'in', 'falling', { debounceTimeout: 500 });

emergencyButton.watch((err, value) => {
  if (err) { logger.error('GPIO_ERROR', err); return; }
  if (value === 0) {
    // Button pressed — send emergency trigger to CMS
    triggerEmergency({
      type: 'VENUE_EMERGENCY',
      source: 'GPIO_BUTTON',
      screenId: config.screenId,
    });
  }
});
```

GPIO emergency trigger bypasses the normal two-step confirmation because the physical button is itself a deliberate manual action (not a UI click). The CMS-side trigger flow still records the emergency with `source: 'GPIO_BUTTON'`.

---

## 7. Corpus Autonomy Window

The 72-hour autonomy window means: if CMS connectivity is lost, the player continues operating with the current corpus for up to 72 hours. After 72 hours, no new corpus version has been applied, and the player must:

1. Continue operating with the current corpus (do not stop playing)
2. Emit a warning-level entropy metric: `CORPUS_STALENESS_WARNING`
3. Alert CMS when connectivity resumes

Local overrides applied during offline operation are capped at 8 hours without cloud confirmation. If a local override exceeds 8 hours without CMS acknowledgment, player-runtime logs `LOCAL_OVERRIDE_EXPIRY` and drops the override, returning to corpus-defined behavior.

---

## 8. OTA Updates

Player-runtime and player-ui are updated via the OTA plugin system documented in `ota-runtime/`. For player-runtime specifically:

- OTA updates arrive as signed bundles via CMS
- player-runtime applies the update to a temp directory
- Verifies signature before replacing running binaries
- Systemd restarts after atomic rename
- Rollback: if restart fails, systemd falls back to previous version directory

The player-ui static files (`index.html`, `player.js`) are part of the same OTA bundle as player-runtime. They update atomically together.

---

## 9. Open Items

1. Emergency content asset format — confirm supported types (image/video/text) and maximum file sizes for GRADE_A vs GRADE_B hardware
2. Device enrollment flow — how does a new Pi get its `screenId` and `deviceToken`? Currently specified in deployment docs but not implemented as a first-class flow
3. Air-gapped venue support — how does audit buffer flushing work when there is no network? Field visit cadence and manual archive path need implementation
4. 4G backup failover — how does player-runtime detect primary network failure and switch to 4G interface? OS-level or application-level detection?
5. GPIO debounce configuration — 500ms may be too short for some button hardware; make configurable
