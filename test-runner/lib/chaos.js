import { execSync }        from 'node:child_process';
import { Clock }           from './clock.js';
import { applyMutation }   from './mutations.js';
import { MUTATION_OPERATIONS } from './state-authority.js';

export class ChaosController {
  constructor(options = {}) {
    this.backendUrl        = options.backendUrl    ?? 'http://localhost:4000';
    this.composeFile       = options.composeFile   ?? 'docker-compose.dev-sim.yml';
    this.dockerEnabled     = options.dockerEnabled ?? true;
    this._clock            = options.clock         ?? new Clock();
    this._replayCapture    = options.replayCapture    ?? null;
    this._replayController = options.replayController ?? null;
    this._replayMode       = options.replayMode       ?? false;
    this._suite            = options.suite            ?? null;
    // Recovery governor (optional). When present, all waitForHealth() calls
    // are routed through the governor's governed retry loop.
    this._governor         = options.governor         ?? null;
    this._pendingRecovery  = null;  // set by inject methods, consumed by waitForHealth
  }

  _mut(entityId, from, to) {
    applyMutation({
      domain: 'chaos', entity_id: entityId,
      operation: MUTATION_OPERATIONS.TRANSITION,
      from_state: from, to_state: to,
      clock: this._clock, mutator: 'chaos',
      suite: this._suite, replayMode: this._replayMode,
    });
  }

  async restartBackend() {
    if (this._replayCapture)    this._replayCapture.recordChaos('restartBackend', {});
    if (this._replayController) await this._replayController.nextChaosEvent('restartBackend');
    this._mut('backend_restart', 'IDLE', 'INJECTING');
    if (!this.dockerEnabled) { this._mut('backend_restart', 'INJECTING', 'RECOVERING'); }
    else {
      execSync(`docker compose -f ${this.composeFile} restart backend`);
      this._mut('backend_restart', 'INJECTING', 'RECOVERING');
    }
    this._pendingRecovery = { category: 'backend_restart', impacted_domains: ['chaos', 'metrics'] };
  }

  async restartDb() {
    if (this._replayCapture)    this._replayCapture.recordChaos('restartDb', {});
    if (this._replayController) await this._replayController.nextChaosEvent('restartDb');
    this._mut('db_restart', 'IDLE', 'INJECTING');
    if (!this.dockerEnabled) { this._mut('db_restart', 'INJECTING', 'RECOVERING'); }
    else {
      execSync(`docker compose -f ${this.composeFile} restart postgres`);
      this._mut('db_restart', 'INJECTING', 'RECOVERING');
    }
    this._pendingRecovery = { category: 'db_restart', impacted_domains: ['chaos', 'metrics'] };
  }

  async outage(ms) {
    if (this._replayCapture)    this._replayCapture.recordChaos('outage', { duration_ms: ms });
    if (this._replayController) await this._replayController.nextChaosEvent('outage');
    this._mut('network_outage', 'IDLE', 'INJECTING');
    if (!this.dockerEnabled) {
      await new Promise(r => setTimeout(r, ms));
      this._mut('network_outage', 'INJECTING', 'RECOVERING');
    } else {
      execSync(`docker compose -f ${this.composeFile} pause backend`);
      await new Promise(r => setTimeout(r, ms));
      execSync(`docker compose -f ${this.composeFile} unpause backend`);
      this._mut('network_outage', 'INJECTING', 'RECOVERING');
    }
    this._pendingRecovery = { category: 'network_outage', impacted_domains: ['chaos', 'metrics'] };
  }

  async contentChurn(n, screenId, waitMs = 1000) {
    if (this._replayCapture)    this._replayCapture.recordChaos('contentChurn', { n, screenId, waitMs });
    if (this._replayController) await this._replayController.nextChaosEvent('contentChurn');
    this._mut('content_churn', 'IDLE', 'INJECTING');

    for (let i = 0; i < n; i++) {
      const contentRes = await fetch(`${this.backendUrl}/content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_type: 'promo_slide', data: { headline: `Churn ${i}`, subheadline: `Iter ${i}` } })
      });
      const content = await contentRes.json();
      await fetch(`${this.backendUrl}/schedules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: content.id, screen_id: screenId, priority: 100 + i, duration: 5 })
      });
      await new Promise(r => setTimeout(r, waitMs));
      await fetch(`${this.backendUrl}/content/${content.id}`, { method: 'DELETE' });
      await new Promise(r => setTimeout(r, 500));
    }
    this._mut('content_churn', 'INJECTING', 'RECOVERING');
  }

  async clearAllContent() {
    if (this._replayCapture)    this._replayCapture.recordChaos('clearAllContent', {});
    if (this._replayController) await this._replayController.nextChaosEvent('clearAllContent');
    const res   = await fetch(`${this.backendUrl}/content`);
    const items = await res.json();
    for (const item of items) {
      await fetch(`${this.backendUrl}/content/${item.id}`, { method: 'DELETE' });
    }
  }

  async waitForHealth(timeout = 60000) {
    if (!this._governor || !this._pendingRecovery) {
      return this._rawWaitForHealth(timeout);
    }

    const { category, impacted_domains } = this._pendingRecovery;
    this._pendingRecovery = null;

    const recoveryId = this._governor.startRecovery(category, {
      impacted_domains,
      causal_chain: [],
      suite: this._suite,
    });

    // Governed retry loop — failRecovery pre-stages FAILED→STARTED transition internally
    while (true) {
      try {
        await this._rawWaitForHealth(timeout);
        this._governor.completeRecovery(recoveryId);
        return true;
      } catch (err) {
        const { shouldRetry, backoff_ms, escalated } = this._governor.failRecovery(recoveryId, err);
        if (!shouldRetry || escalated) {
          throw new Error(`Governed recovery escalated [${category}]: ${err.message}`);
        }
        await this._governor.wait(backoff_ms);
        // loop continues: failRecovery already transitioned FAILED→STARTED for same recoveryId
      }
    }
  }

  // Raw polling loop — used directly when no governor is present, or as inner loop when governed.
  async _rawWaitForHealth(timeout = 60000) {
    const start = this._clock.now();
    while (this._clock.now() - start < timeout) {
      try {
        const res  = await fetch(`${this.backendUrl}/health`);
        const data = await res.json();
        if (data.status === 'ok') return true;
      } catch { /* transient */ }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Backend failed to become healthy');
  }
}
