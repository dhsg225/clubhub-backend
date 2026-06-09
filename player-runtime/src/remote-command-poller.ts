/**
 * Remote command poller — player-side command executor.
 *
 * Polls CMS API for pending operator commands. Executes them with:
 * - Idempotency via append-only execution history (crash-safe)
 * - Deduplication: command_id tracked in history before execution starts
 * - Poison protection: commands with 3+ failed attempts permanently skipped
 * - Status reporting: ACKNOWLEDGED → EXECUTING → COMPLETED/FAILED
 * - Timeout enforcement per command type
 * - Offline-safe: poll failure is non-fatal, retries on next interval
 *
 * Execution history lives at COMMAND_HISTORY_PATH (append-only JSONL).
 * Written BEFORE execution starts to survive crashes — safe to re-check
 * command_id on restart; already-COMPLETED commands are deduplicated.
 *
 * Command types and their player-side behavior:
 *   REBOOT_DEVICE             — calls `sudo systemctl reboot` (graceful) or `sudo reboot`
 *   RESTART_RUNTIME           — calls `sudo systemctl restart clubhub-player` or PM2
 *   FORCE_SYNC                — signals orchestrator to trigger immediate corpus sync
 *   ENTER_MAINTENANCE_MODE    — pauses playback, sets maintenance flag in state
 *   EXIT_MAINTENANCE_MODE     — resumes playback, clears maintenance flag
 *   ROLLBACK_CORPUS           — signals orchestrator to apply previous corpus snapshot
 *   WATCHDOG_DIAGNOSTICS      — runs health checks, reports results back
 *   FETCH_SUPPORT_BUNDLE      — runs diagnostics-bundle.sh, uploads to fleet dashboard
 *
 * What operators will do wrong:
 *   - Issue REBOOT_DEVICE then immediately issue another command: deduplication
 *     and the one-pending-at-a-time server constraint prevent this.
 *   - Re-issue the same command thinking it failed: history deduplication
 *     will catch it if command_id matches.
 *   - Issue commands to offline players: commands expire server-side after 24h.
 *     Player executes on reconnect if within expiry window.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS      = 30_000;   // normal poll interval
const EAGER_POLL_INTERVAL_MS = 10_000;  // poll faster after receiving a command
const EAGER_DRAIN_CYCLES    = 3;        // how many eager cycles before returning to normal
const MAX_ATTEMPTS          = 3;        // attempts before marking command as POISON
const COMMAND_HISTORY_PATH  = process.env['COMMAND_HISTORY_PATH']
  ?? '/var/lib/clubhub/command-history.jsonl';

// Per-command timeouts for execution
const COMMAND_TIMEOUTS: Record<string, number> = {
  REBOOT_DEVICE:          10_000,   // 10s — reboot is near-instant
  RESTART_RUNTIME:        20_000,   // 20s — PM2/systemctl restart
  FORCE_SYNC:             30_000,   // 30s — corpus fetch
  ENTER_MAINTENANCE_MODE:  5_000,   // 5s
  EXIT_MAINTENANCE_MODE:   5_000,   // 5s
  ROLLBACK_CORPUS:        15_000,   // 15s — corpus snapshot apply
  WATCHDOG_DIAGNOSTICS:   30_000,   // 30s — health checks
  FETCH_SUPPORT_BUNDLE:  120_000,   // 2min — bundle + upload
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingCommand {
  command_id: string;
  command_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
}

export interface CommandHistoryEntry {
  command_id: string;
  command_type: string;
  received_at: number;        // Unix ms when player first saw this command
  status: 'ACKNOWLEDGED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'POISON' | 'EXPIRED';
  attempts: number;
  started_at?: number;
  completed_at?: number;
  error?: string;
  result?: Record<string, unknown>;
}

/**
 * Callbacks the poller uses to signal the orchestrator.
 * Avoids circular imports — orchestrator passes these in on construction.
 */
export interface CommandExecutionCallbacks {
  triggerCorpusSync: () => Promise<void>;
  enterMaintenanceMode: () => void;
  exitMaintenanceMode: () => void;
  rollbackToPreviousCorpus: () => boolean;  // returns true if previous snapshot exists
  getWatchdogDiagnostics: () => Record<string, unknown>;
}

// ── History helpers ───────────────────────────────────────────────────────────

function ensureHistoryDir(): void {
  const dir = path.dirname(COMMAND_HISTORY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendHistory(entry: CommandHistoryEntry): void {
  ensureHistoryDir();
  fs.appendFileSync(COMMAND_HISTORY_PATH, JSON.stringify(entry) + '\n', 'utf8');
}

function loadHistory(): Map<string, CommandHistoryEntry> {
  const map = new Map<string, CommandHistoryEntry>();
  if (!fs.existsSync(COMMAND_HISTORY_PATH)) return map;

  try {
    const lines = fs.readFileSync(COMMAND_HISTORY_PATH, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CommandHistoryEntry;
        // Last write wins — history is append-only but we track latest status
        map.set(entry.command_id, entry);
      } catch {
        // Skip malformed lines — crash during write may produce partial JSON
      }
    }
  } catch (err) {
    console.error(`[command-poller] Failed to read history: ${String(err)}`);
  }
  return map;
}

function getAttemptCount(history: Map<string, CommandHistoryEntry>, commandId: string): number {
  return history.get(commandId)?.attempts ?? 0;
}

// ── System calls (isolated for testability) ───────────────────────────────────

function rebootDevice(): void {
  console.log('[command-poller] Executing REBOOT_DEVICE — calling sudo systemctl reboot');
  // Attempt graceful systemd reboot first; fall back to POSIX reboot
  const result = spawnSync('sudo', ['systemctl', 'reboot'], { timeout: 8_000 });
  if (result.error || result.status !== 0) {
    // Fallback: direct reboot command
    spawnSync('sudo', ['reboot'], { timeout: 8_000 });
  }
}

function restartRuntime(): void {
  console.log('[command-poller] Executing RESTART_RUNTIME');
  // Try PM2 first (development/manual deployments), then systemd (production)
  const pm2 = spawnSync('pm2', ['restart', 'clubhub-player'], { timeout: 15_000 });
  if (pm2.error || pm2.status !== 0) {
    spawnSync('sudo', ['systemctl', 'restart', 'clubhub-player'], { timeout: 15_000 });
  }
}

function runDiagnosticsBundle(screenId: string): string {
  const bundleScript = '/usr/local/bin/diagnostics-bundle.sh';
  const fallbackScript = path.join(os.homedir(), 'scripts', 'diagnostics-bundle.sh');
  const script = fs.existsSync(bundleScript) ? bundleScript : fallbackScript;

  if (!fs.existsSync(script)) {
    return 'diagnostics-bundle.sh not found on this device';
  }

  try {
    const result = execSync(`bash "${script}" --screen-id "${screenId}"`, {
      timeout: 100_000,
      env: { ...process.env },
    });
    return result.toString('utf8').slice(0, 2000); // cap output size
  } catch (err) {
    return `Bundle script failed: ${String(err)}`;
  }
}

// ── RemoteCommandPoller ───────────────────────────────────────────────────────

export class RemoteCommandPoller {
  private readonly cmsApiUrl: string;
  private readonly screenId: string;
  private readonly callbacks: CommandExecutionCallbacks;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private eagerCyclesRemaining = 0;
  private running = false;

  constructor(
    cmsApiUrl: string,
    screenId: string,
    callbacks: CommandExecutionCallbacks,
  ) {
    this.cmsApiUrl = cmsApiUrl;
    this.screenId = screenId;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(`[command-poller] Starting — screen_id=${this.screenId}`);
    this.scheduleNext(POLL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[command-poller] Stopped');
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => { void this.poll(); }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const command = await this.fetchPendingCommand();

      if (command) {
        this.eagerCyclesRemaining = EAGER_DRAIN_CYCLES;
        await this.handleCommand(command);
      } else {
        if (this.eagerCyclesRemaining > 0) {
          this.eagerCyclesRemaining--;
        }
      }
    } catch (err) {
      // Poll failure is non-fatal — player continues operating
      console.warn(`[command-poller] Poll error (non-fatal): ${String(err)}`);
    }

    const nextInterval = this.eagerCyclesRemaining > 0
      ? EAGER_POLL_INTERVAL_MS
      : POLL_INTERVAL_MS;

    this.scheduleNext(nextInterval);
  }

  private async fetchPendingCommand(): Promise<PendingCommand | null> {
    const url = `${this.cmsApiUrl}/api/v2/screens/${this.screenId}/commands/pending`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      if (response.status === 404) return null;  // screen not found — non-fatal
      throw new Error(`Unexpected status ${response.status}`);
    }

    const body = await response.json() as { command: PendingCommand | null };
    return body.command;
  }

  private async handleCommand(command: PendingCommand): Promise<void> {
    const { command_id, command_type } = command;
    const history = loadHistory();

    // ── Deduplication: already executed? ──────────────────────────────────
    const existing = history.get(command_id);
    if (existing) {
      if (existing.status === 'COMPLETED') {
        console.log(`[command-poller] ${command_id} already COMPLETED — skipping (idempotent)`);
        return;
      }
      if (existing.status === 'POISON') {
        console.warn(`[command-poller] ${command_id} marked POISON after ${existing.attempts} failures — permanently skipping`);
        // Still report to server so it clears from pending
        await this.reportStatus(command_id, 'FAILED', {
          error: `POISON: exceeded max attempts (${MAX_ATTEMPTS})`,
          attempts: existing.attempts,
        });
        return;
      }
      if (existing.status === 'EXPIRED') {
        console.warn(`[command-poller] ${command_id} marked EXPIRED — skipping`);
        return;
      }
    }

    // ── Expiry check ───────────────────────────────────────────────────────
    const expiresAt = new Date(command.expires_at).getTime();
    if (Date.now() > expiresAt) {
      console.warn(`[command-poller] ${command_id} expired — skipping`);
      appendHistory({
        command_id,
        command_type,
        received_at: Date.now(),
        status: 'EXPIRED',
        attempts: getAttemptCount(history, command_id),
      });
      return;
    }

    // ── Poison check ───────────────────────────────────────────────────────
    const attempts = getAttemptCount(history, command_id);
    if (attempts >= MAX_ATTEMPTS) {
      console.error(
        `[command-poller] ${command_id} (${command_type}) reached max attempts ` +
        `(${attempts}/${MAX_ATTEMPTS}) — marking POISON`
      );
      appendHistory({
        command_id,
        command_type,
        received_at: Date.now(),
        status: 'POISON',
        attempts,
      });
      await this.reportStatus(command_id, 'FAILED', {
        error: `Poison command: exceeded ${MAX_ATTEMPTS} attempts without success`,
        attempts,
      });
      return;
    }

    // ── Acknowledge ────────────────────────────────────────────────────────
    console.log(`[command-poller] Received command=${command_type} id=${command_id} attempt=${attempts + 1}`);

    appendHistory({
      command_id,
      command_type,
      received_at: Date.now(),
      status: 'ACKNOWLEDGED',
      attempts: attempts + 1,
    });

    await this.reportStatus(command_id, 'ACKNOWLEDGED');

    // ── Execute ────────────────────────────────────────────────────────────
    appendHistory({
      command_id,
      command_type,
      received_at: Date.now(),
      status: 'EXECUTING',
      attempts: attempts + 1,
      started_at: Date.now(),
    });

    await this.reportStatus(command_id, 'EXECUTING');

    const timeout = COMMAND_TIMEOUTS[command_type] ?? 30_000;
    let result: Record<string, unknown> | undefined;
    let error: string | undefined;
    let success = false;

    try {
      result = await this.executeCommand(command, timeout);
      success = true;
    } catch (err) {
      error = String(err);
      console.error(`[command-poller] Command failed: ${command_type} — ${error}`);
    }

    // ── Record completion ──────────────────────────────────────────────────
    const finalStatus: CommandHistoryEntry['status'] = success ? 'COMPLETED' : 'FAILED';

    appendHistory({
      command_id,
      command_type,
      received_at: Date.now(),
      status: finalStatus,
      attempts: attempts + 1,
      completed_at: Date.now(),
      ...(result !== undefined && { result }),
      ...(error !== undefined && { error }),
    });

    await this.reportStatus(command_id, success ? 'COMPLETED' : 'FAILED', result ?? { error });

    if (success) {
      console.log(`[command-poller] Command completed: ${command_type} id=${command_id}`);
    }
  }

  private async executeCommand(
    command: PendingCommand,
    timeout: number,
  ): Promise<Record<string, unknown>> {
    const { command_type, payload } = command;

    // Wrap execution in a timeout race
    const execution = this.dispatchCommand(command_type, payload ?? {});
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Command timeout after ${timeout}ms: ${command_type}`));
      }, timeout);
    });

    return Promise.race([execution, timeoutPromise]);
  }

  private async dispatchCommand(
    commandType: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (commandType) {
      case 'REBOOT_DEVICE': {
        // Report EXECUTING before reboot — won't get COMPLETED report (process dies)
        // Server-side: if no COMPLETED within expiry, it will expire naturally
        rebootDevice();
        return { action: 'reboot_initiated', at: Date.now() };
      }

      case 'RESTART_RUNTIME': {
        restartRuntime();
        return { action: 'restart_initiated', at: Date.now() };
      }

      case 'FORCE_SYNC': {
        await this.callbacks.triggerCorpusSync();
        return { action: 'corpus_sync_triggered', at: Date.now() };
      }

      case 'ENTER_MAINTENANCE_MODE': {
        this.callbacks.enterMaintenanceMode();
        return { action: 'maintenance_mode_entered', at: Date.now() };
      }

      case 'EXIT_MAINTENANCE_MODE': {
        this.callbacks.exitMaintenanceMode();
        return { action: 'maintenance_mode_exited', at: Date.now() };
      }

      case 'ROLLBACK_CORPUS': {
        const success = this.callbacks.rollbackToPreviousCorpus();
        if (!success) {
          throw new Error('No previous corpus snapshot available — cannot rollback');
        }
        return { action: 'corpus_rolled_back', at: Date.now() };
      }

      case 'WATCHDOG_DIAGNOSTICS': {
        const diagnostics = this.callbacks.getWatchdogDiagnostics();
        return { action: 'diagnostics_collected', diagnostics, at: Date.now() };
      }

      case 'FETCH_SUPPORT_BUNDLE': {
        const outputPath = (payload['output_path'] as string | undefined)
          ?? '/tmp/clubhub-support-bundle';
        const bundleOutput = runDiagnosticsBundle(this.screenId);
        return {
          action: 'support_bundle_generated',
          output_path: outputPath,
          summary: bundleOutput.slice(0, 500),
          at: Date.now(),
        };
      }

      default: {
        throw new Error(`Unknown command type: ${commandType}`);
      }
    }
  }

  private async reportStatus(
    commandId: string,
    status: 'ACKNOWLEDGED' | 'EXECUTING' | 'COMPLETED' | 'FAILED',
    result?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const url = `${this.cmsApiUrl}/api/v2/commands/${commandId}/status`;
      const body: Record<string, unknown> = { status };
      if (result) body['result'] = result;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok && response.status !== 409) {
        // 409 = already in terminal state — that's fine (deduplication)
        console.warn(`[command-poller] Status report failed: ${response.status} for ${commandId}`);
      }
    } catch (err) {
      // Non-fatal: we've already written to local history
      console.warn(`[command-poller] Failed to report status to CMS (non-fatal): ${String(err)}`);
    }
  }
}
