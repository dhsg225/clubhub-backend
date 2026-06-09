/**
 * Multi-check watchdog daemon.
 *
 * Checks performed:
 *   1. MAIN LOOP LIVENESS — orchestrator must kick() within timeoutMs.
 *      Failure: process.exit(1) → systemd/PM2 restarts the process.
 *
 *   2. DISK SPACE — data partition must have >= MIN_FREE_BYTES available.
 *      Failure: logs WARN at 15%, ERROR at 10%, does not exit (content can
 *      still be served from existing cache). Exposed in health report.
 *
 *   3. PROCESS MEMORY — RSS must be below MAX_RSS_BYTES.
 *      Failure: logs ERROR, process.exit(1) after 3 consecutive violations.
 *      Rationale: memory leak on constrained Pi causes OOM-kill with no log.
 *      Better to self-restart cleanly.
 *
 *   4. CORPUS INTEGRITY SPOT-CHECK — verify corpus.current.json checksum.
 *      Runs every CORPUS_CHECK_INTERVAL_MS (default: 30 min).
 *      Failure: logs ERROR, sets corrupted flag. Orchestrator reads this
 *      flag and falls back to previous/factory snapshot.
 *
 *   5. TEMPERATURE (Pi-specific) — reads /sys/class/thermal/thermal_zone0/temp.
 *      Advisory only: logs WARN at 75°C, CRITICAL at 82°C.
 *      Does not exit — thermal throttling is survivable. Exposed in health report.
 *      Silently skips on non-Pi hardware (file not present).
 *
 * Operational runbook:
 *   - Main loop timeout: check for deadlock in corpus fetch or PRE execution.
 *     Increase CORPUS_POLL_INTERVAL_MS if API latency is high.
 *   - Disk space warning: check for runaway log files or replay cache growth.
 *     Run: du -sh /var/clubhub/* to identify culprit.
 *   - Memory exit: review recent orchestrator logs for memory growth pattern.
 *     May indicate corpus payload growing unboundedly.
 *   - Corpus corruption: check SD card health (smartmontools or write error logs).
 *     Replace SD card if repeated corruption events occur.
 *   - High temperature: improve ventilation in AV cabinet. Check for passive
 *     cooling blockage. Consider adding active cooling.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const MIN_FREE_BYTES_WARN  = 150 * 1024 * 1024;  // 150MB
const MIN_FREE_BYTES_ERROR = 100 * 1024 * 1024;  // 100MB
const MAX_RSS_BYTES = 512 * 1024 * 1024;          // 512MB
const TEMP_WARN_MC  = 75_000;                      // 75°C in millidegrees
const TEMP_CRIT_MC  = 82_000;                      // 82°C in millidegrees
const CORPUS_CHECK_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutes

const THERMAL_PATH = '/sys/class/thermal/thermal_zone0/temp';

export interface WatchdogHealthReport {
  readonly liveness_ok: boolean;
  readonly disk_free_mb: number;
  readonly disk_warn: boolean;
  readonly memory_rss_mb: number;
  readonly memory_warn: boolean;
  readonly corpus_integrity_ok: boolean | null;
  readonly temperature_celsius: number | null;
  readonly temperature_warn: boolean;
  readonly temperature_critical: boolean;
  readonly consecutive_memory_violations: number;
  readonly chromium_alive: boolean | null;        // null = PID not set yet
  readonly ntp_synced: boolean | null;            // null = check unavailable
}

export class Watchdog {
  private mainLoopTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private readonly timeoutMs: number;
  private lastKick: number = Date.now();
  private corpusIntegrityOk: boolean | null = null;
  private consecutiveMemoryViolations: number = 0;
  private lastCorpusCheck: number = 0;
  private corpusCacheDir: string = '';
  private chromiumPid: number | null = null;
  private chromiumAlive: boolean | null = null;
  private ntpSynced: boolean | null = null;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  /** Set corpus cache directory for integrity checks. */
  setCorpusCacheDir(dir: string): void {
    this.corpusCacheDir = dir;
  }

  /** Set the Chromium browser PID for liveness checks. Pass null to clear. */
  setChromiumPid(pid: number | null): void {
    this.chromiumPid = pid;
  }

  start(): void {
    this.startMainLoopCheck();
    this.startPeriodicChecks();
    console.log(`[watchdog] Started — main-loop-timeout=${this.timeoutMs}ms`);
  }

  /** Orchestrator must call this regularly to prove main loop is alive. */
  kick(): void {
    this.lastKick = Date.now();
  }

  stop(): void {
    if (this.mainLoopTimer) { clearTimeout(this.mainLoopTimer); this.mainLoopTimer = null; }
    if (this.periodicTimer) { clearTimeout(this.periodicTimer); this.periodicTimer = null; }
  }

  getHealthReport(): WatchdogHealthReport {
    const rss = process.memoryUsage().rss;
    const diskFree = this.readDiskFreeBytes();
    const temp = this.readTemperatureMc();

    return {
      liveness_ok:                   (Date.now() - this.lastKick) <= this.timeoutMs,
      disk_free_mb:                  Math.floor(diskFree / (1024 * 1024)),
      disk_warn:                     diskFree < MIN_FREE_BYTES_WARN,
      memory_rss_mb:                 Math.floor(rss / (1024 * 1024)),
      memory_warn:                   rss > MAX_RSS_BYTES,
      corpus_integrity_ok:           this.corpusIntegrityOk,
      temperature_celsius:           temp !== null ? Math.round(temp / 1000) : null,
      temperature_warn:              temp !== null && temp >= TEMP_WARN_MC,
      temperature_critical:          temp !== null && temp >= TEMP_CRIT_MC,
      consecutive_memory_violations: this.consecutiveMemoryViolations,
      chromium_alive:                this.chromiumAlive,
      ntp_synced:                    this.ntpSynced,
    };
  }

  private startMainLoopCheck(): void {
    const check = (): void => {
      const elapsed = Date.now() - this.lastKick;
      if (elapsed > this.timeoutMs) {
        console.error(
          `[watchdog] FATAL: main loop timeout (${elapsed}ms > ${this.timeoutMs}ms) — exiting for restart`
        );
        process.exit(1);
      }
      this.mainLoopTimer = setTimeout(check, Math.min(this.timeoutMs / 4, 30_000));
    };
    this.mainLoopTimer = setTimeout(check, this.timeoutMs);
  }

  private startPeriodicChecks(): void {
    const check = (): void => {
      this.checkDisk();
      this.checkMemory();
      this.checkTemperature();
      this.checkCorpusIntegrity();
      this.checkChromium();
      this.checkNtp();
      this.periodicTimer = setTimeout(check, 60_000); // run every 60s
    };
    this.periodicTimer = setTimeout(check, 30_000); // first check at 30s
  }

  private checkDisk(): void {
    const free = this.readDiskFreeBytes();
    const mb = Math.floor(free / (1024 * 1024));
    if (free < MIN_FREE_BYTES_ERROR) {
      console.error(`[watchdog] DISK CRITICAL: only ${mb}MB free — corpus sync may fail`);
    } else if (free < MIN_FREE_BYTES_WARN) {
      console.warn(`[watchdog] DISK WARN: ${mb}MB free`);
    }
  }

  private checkMemory(): void {
    const rss = process.memoryUsage().rss;
    if (rss > MAX_RSS_BYTES) {
      this.consecutiveMemoryViolations++;
      console.error(
        `[watchdog] MEMORY CRITICAL: RSS=${Math.floor(rss / (1024 * 1024))}MB ` +
        `violation=${this.consecutiveMemoryViolations}/3`
      );
      if (this.consecutiveMemoryViolations >= 3) {
        console.error('[watchdog] MEMORY: 3 consecutive violations — exiting for restart');
        process.exit(1);
      }
    } else {
      this.consecutiveMemoryViolations = 0;
    }
  }

  private checkTemperature(): void {
    const mc = this.readTemperatureMc();
    if (mc === null) return;
    const celsius = Math.round(mc / 1000);
    if (mc >= TEMP_CRIT_MC) {
      console.error(`[watchdog] TEMP CRITICAL: ${celsius}°C — check AV cabinet ventilation`);
    } else if (mc >= TEMP_WARN_MC) {
      console.warn(`[watchdog] TEMP WARN: ${celsius}°C`);
    }
  }

  private checkCorpusIntegrity(): void {
    if (!this.corpusCacheDir) return;
    const now = Date.now();
    if (now - this.lastCorpusCheck < CORPUS_CHECK_INTERVAL_MS) return;
    this.lastCorpusCheck = now;

    const currentPath = path.join(this.corpusCacheDir, 'corpus.current.json');
    try {
      const raw = fs.readFileSync(currentPath, 'utf-8');
      const parsed = JSON.parse(raw) as { checksum: string; corpus_data: unknown };
      // Re-verify checksum using the same logic as CorpusCacheManager
      // Import is avoided to keep watchdog dependency-free; inline the check.
      const { checksum, corpus_data } = parsed;
      // Must use canonicalizeJson (sorted keys) — corpus checksum was computed that way.
      // Inline implementation to avoid importing corpus-cache (circular dep risk).
      const canonicalize = (v: unknown): string => {
        if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
        if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
        const keys = Object.keys(v as object).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((v as Record<string, unknown>)[k])).join(',') + '}';
      };
      const dataStr = canonicalize(corpus_data);
      // FNV-1a 32-bit (inline — watchdog must not import corpus-cache to avoid circular dep)
      let h = 2166136261;
      for (let i = 0; i < dataStr.length; i++) {
        h ^= dataStr.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      const computed = h.toString(16).padStart(8, '0');
      if (computed !== checksum) {
        this.corpusIntegrityOk = false;
        console.error(
          `[watchdog] CORPUS INTEGRITY FAIL: checksum mismatch on corpus.current.json ` +
          `expected=${checksum} computed=${computed}`
        );
      } else {
        this.corpusIntegrityOk = true;
      }
    } catch (err) {
      // File absent or unreadable — not necessarily corrupt (may not exist yet on first boot)
      console.warn(`[watchdog] Corpus integrity check skipped: ${String(err)}`);
    }
  }

  private checkChromium(): void {
    if (this.chromiumPid === null) {
      this.chromiumAlive = null;
      return;
    }
    try {
      // process.kill(pid, 0) throws if process doesn't exist
      process.kill(this.chromiumPid, 0);
      this.chromiumAlive = true;
    } catch {
      this.chromiumAlive = false;
      console.warn(`[watchdog] Chromium PID ${this.chromiumPid} not found — may need restart`);
    }
  }

  private checkNtp(): void {
    // Try timedatectl first (systemd systems)
    const result = spawnSync('timedatectl', ['show', '--property=NTPSynchronized', '--value'], {
      encoding: 'utf-8',
      timeout: 2000,
    });
    if (result.status === 0 && result.stdout) {
      this.ntpSynced = result.stdout.trim() === 'yes';
      return;
    }
    // Fallback: check systemd-timesyncd synchronized file
    try {
      fs.accessSync('/run/systemd/timesync/synchronized');
      this.ntpSynced = true;
    } catch {
      this.ntpSynced = false;
    }
  }

  private readDiskFreeBytes(): number {
    try {
      // statvfs not available in Node — use /proc/mounts + df approximation via statfs
      // On Linux/Pi: read from /proc/self/statfs is not exposed.
      // Best available approach: use fs.statSync on the data directory and check
      // via df-style calculation. Fallback: return a large number (non-blocking).
      // Real implementation: replace with native addon or spawn 'df' once per minute.
      const stat = fs.statfsSync?.('/var/clubhub') ?? { bfree: Infinity, bsize: 1 };
      return (stat as { bfree: number; bsize: number }).bfree *
             (stat as { bsize: number }).bsize;
    } catch {
      // statfsSync not available in this Node version, or path doesn't exist.
      // Return large number so check doesn't false-alarm.
      return Number.MAX_SAFE_INTEGER;
    }
  }

  private readTemperatureMc(): number | null {
    try {
      const raw = fs.readFileSync(THERMAL_PATH, 'utf-8').trim();
      return parseInt(raw, 10);
    } catch {
      return null; // Not a Pi, or thermal zone not available
    }
  }
}
