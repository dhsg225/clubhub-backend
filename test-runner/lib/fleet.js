import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';

export class FleetController {
  constructor(metrics, options = {}) {
    this.metrics = metrics;
    this.count = options.count ?? 10;
    this.prefix = options.prefix ?? 'test-screen';
    this.statusPort = options.statusPort ?? 3101;
    this.backendUrl = options.backendUrl ?? 'http://localhost:4000';
    this.deterministic = options.deterministic ?? false;
    this.seed = options.seed ?? '42';
    this.process = null;
  }

  async start() {
    const simulatorPath = path.resolve(process.cwd(), 'simulator/fake-pi.js');
    
    this.process = spawn('node', [simulatorPath], {
      env: {
        ...process.env,
        SCREEN_COUNT: this.count,
        SCREEN_PREFIX: this.prefix,
        STATUS_PORT: this.statusPort,
        BACKEND_URL: this.backendUrl,
        POLL_INTERVAL: 15000,
        JITTER_ENABLED: 'true',
        DETERMINISTIC: this.deterministic ? 'true' : 'false',
        SEED: this.seed
      },
      stdio: ['inherit', 'pipe', 'inherit']
    });

    const rl = readline.createInterface({ input: this.process.stdout });
    rl.on('line', (line) => {
      try {
        const event = JSON.parse(line);
        this.metrics.ingest(event);
      } catch {
        // ignore non-json output
      }
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async waitForAllPolled(timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.metrics.screens.size >= this.count) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Fleet failed to poll: only ${this.metrics.screens.size}/${this.count} screens seen`);
  }

  async rebootAll() {
    const res = await fetch(`http://localhost:${this.statusPort}/reboot-all`, { method: 'POST' });
    if (!res.ok) throw new Error(`Fleet reboot failed: ${res.status}`);
  }

  async offlineScreen(id, ms) {
    const res = await fetch(`http://localhost:${this.statusPort}/offline/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMs: ms })
    });
    if (!res.ok) throw new Error(`Fleet offline failed: ${res.status}`);
  }
}
