/**
 * Chromium kiosk launcher and process monitor.
 *
 * Launches player-ui in Chromium kiosk mode.
 * Monitors process and restarts if it exits unexpectedly.
 */
import { spawn, type ChildProcess } from 'node:child_process';

const CHROMIUM_ARGS = [
  '--kiosk',
  '--noerrdialogs',
  '--disable-infobars',
  '--disable-translate',
  '--disable-features=TranslateUI',
  '--no-first-run',
  '--disable-pinch',
  '--overscroll-history-navigation=0',
  '--disable-web-security',  // required for local file access on Pi
  // Run directly on KMS/DRM — no X11 or Wayland compositor required.
  // Necessary on Raspberry Pi OS Lite (Bookworm) which ships no display server.
  '--ozone-platform=drm',
  '--use-gl=egl',
];

export class ChromiumLauncher {
  private process: ChildProcess | null = null;
  private readonly url: string;
  private restartCount = 0;
  private readonly maxRestarts = 10;
  private stopped = false;

  constructor(url: string) {
    this.url = url;
  }

  start(): void {
    if (this.stopped) return;
    if (this.restartCount >= this.maxRestarts) {
      console.error(`[chromium-launcher] Max restarts (${this.maxRestarts}) reached — giving up`);
      return;
    }

    console.log(`[chromium-launcher] Launching Chromium (attempt ${this.restartCount + 1}): ${this.url}`);
    this.process = spawn('chromium-browser', [...CHROMIUM_ARGS, this.url], {
      stdio: 'ignore',
      detached: false,
    });

    this.process.on('exit', (code) => {
      if (this.stopped) return;
      this.restartCount++;
      console.warn(`[chromium-launcher] Chromium exited (code=${code}), restarting in 2s...`);
      setTimeout(() => { this.start(); }, 2000);
    });

    this.process.on('error', (err) => {
      console.error(`[chromium-launcher] Chromium launch error: ${err.message}`);
    });
  }

  getPid(): number | null {
    return this.process?.pid ?? null;
  }

  stop(): void {
    this.stopped = true;
    this.process?.kill('SIGTERM');
    this.process = null;
  }
}
