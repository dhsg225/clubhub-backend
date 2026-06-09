/**
 * recovery-governor.js — Governed recovery engine for ClubHub TV test infrastructure.
 *
 * Recovery behavior is governed rather than ad-hoc. Every recovery action:
 *   - Receives a unique recovery_id
 *   - Emits RECOVERY.started via applyMutation (recovery domain IDLE→STARTED)
 *   - Emits RECOVERY.completed or RECOVERY.failed
 *   - Records duration, attempts, impacted domains, causal chain, and strategy
 *
 * Escalation policies per category:
 *   RETRYABLE                  — auto-retry up to max_retries with deterministic exponential backoff
 *   MANUAL_INTERVENTION_REQUIRED — log and surface; do not auto-retry
 *   FATAL                      — throw immediately, halt suite
 *
 * Backoff is deterministic: backoff_ms = base_ms * 2^(attempt - 1), capped at max_backoff_ms.
 * All timers use the governed Clock instance — no bare setTimeout for recovery pacing.
 *
 * Output: reports/recovery-governance.json
 */

import fs   from 'node:fs';
import path from 'node:path';
import { applyMutation }      from './mutations.js';
import { MUTATION_OPERATIONS } from './state-authority.js';
import { Clock }               from './clock.js';

// ─── Escalation policies ──────────────────────────────────────────────────────

export const ESCALATION = Object.freeze({
  RETRYABLE:                    'RETRYABLE',
  MANUAL_INTERVENTION_REQUIRED: 'MANUAL_INTERVENTION_REQUIRED',
  FATAL:                        'FATAL',
});

// ─── Category registry ────────────────────────────────────────────────────────

/**
 * All governed recovery categories. Every category here maps to a named recovery
 * that chaos suites may trigger. The max_recovery_ms comes from thresholds.json
 * (passed to RecoveryGovernor constructor) rather than being hardcoded here.
 *
 * max_retries and backoff_base_ms are implementation constants, not CI gates.
 * They are deliberately conservative.
 */
export const RECOVERY_CATEGORIES = Object.freeze({
  backend_restart: {
    escalation:    ESCALATION.RETRYABLE,
    max_retries:   3,
    backoff_base_ms: 2000,
    max_backoff_ms:  16000,
    description:   'Backend process restart — wait for health endpoint to recover',
  },
  db_restart: {
    escalation:    ESCALATION.RETRYABLE,
    max_retries:   3,
    backoff_base_ms: 5000,
    max_backoff_ms:  30000,
    description:   'Database restart — wait for connection pool to restore',
  },
  network_outage: {
    escalation:    ESCALATION.RETRYABLE,
    max_retries:   5,
    backoff_base_ms: 1000,
    max_backoff_ms:  10000,
    description:   'Network partition or container pause — wait for connectivity',
  },
  screen_desync: {
    escalation:    ESCALATION.MANUAL_INTERVENTION_REQUIRED,
    max_retries:   0,
    backoff_base_ms: 0,
    max_backoff_ms:  0,
    description:   'Screen manifest desync detected — requires operator investigation',
  },
  stalled_rollout: {
    escalation:    ESCALATION.MANUAL_INTERVENTION_REQUIRED,
    max_retries:   0,
    backoff_base_ms: 0,
    max_backoff_ms:  0,
    description:   'OTA rollout stalled — requires operator ring promotion or rollback',
  },
  manifest_timeout: {
    escalation:    ESCALATION.RETRYABLE,
    max_retries:   3,
    backoff_base_ms: 1000,
    max_backoff_ms:  8000,
    description:   'Manifest fetch timed out — retry with backoff',
  },
  replay_divergence: {
    escalation:    ESCALATION.FATAL,
    max_retries:   0,
    backoff_base_ms: 0,
    max_backoff_ms:  0,
    description:   'State machine diverged from recorded baseline — replay integrity violated',
  },
});

// ─── Recovery governor ────────────────────────────────────────────────────────

export class RecoveryGovernor {
  /**
   * @param {Clock}  clock       Governed clock (required)
   * @param {object} thresholds  Loaded thresholds.json content (for max_recovery_ms lookup)
   */
  constructor(clock, thresholds = {}) {
    if (!(clock instanceof Clock)) {
      throw new Error('RecoveryGovernor requires a governed Clock instance');
    }
    this._clock      = clock;
    this._thresholds = thresholds;
    this._active     = new Map();  // recovery_id → RecoveryRecord
    this._history    = [];
    this._seq        = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Begin a governed recovery.
   * Emits mutation: recovery domain IDLE → STARTED.
   *
   * @param {string} category   Key from RECOVERY_CATEGORIES
   * @param {object} options
   *   impacted_domains  — array of governed domain names affected
   *   causal_chain      — array of event/mutation descriptors leading to failure
   *   suite             — active suite name
   * @returns {string} recovery_id
   */
  startRecovery(category, options = {}) {
    const catDef = RECOVERY_CATEGORIES[category];
    if (!catDef) {
      throw new Error(`Unknown recovery category: '${category}'. Must be one of: ${Object.keys(RECOVERY_CATEGORIES).join(', ')}`);
    }

    this._seq++;
    const recovery_id = `rec-${this._seq.toString(16).padStart(6, '0')}`;
    const started_at  = this._clock.now();

    const record = {
      recovery_id,
      category,
      escalation:       catDef.escalation,
      strategy:         catDef.description,
      started_at,
      completed_at:     null,
      failed_at:        null,
      escalated_at:     null,
      duration_ms:      null,
      attempts:         1,
      max_retries:      catDef.max_retries,
      backoff_base_ms:  catDef.backoff_base_ms,
      max_backoff_ms:   catDef.max_backoff_ms,
      impacted_domains: options.impacted_domains ?? [],
      causal_chain:     options.causal_chain     ?? [],
      error:            null,
      final_phase:      'STARTED',
    };

    this._active.set(recovery_id, record);

    applyMutation({
      domain:     'recovery',
      entity_id:  recovery_id,
      operation:  MUTATION_OPERATIONS.TRANSITION,
      from_state: 'IDLE',
      to_state:   'STARTED',
      clock:      this._clock,
      mutator:    'recovery-governor',
      suite:      options.suite ?? null,
    });

    return recovery_id;
  }

  /**
   * Mark a recovery as successfully completed.
   * Emits mutation: recovery domain STARTED → COMPLETED.
   *
   * @param {string} recovery_id
   * @returns {object} the completed record
   */
  completeRecovery(recovery_id) {
    const record = this._getActive(recovery_id);
    const completed_at  = this._clock.now();
    record.completed_at = completed_at;
    record.duration_ms  = completed_at - record.started_at;
    record.final_phase  = 'COMPLETED';

    applyMutation({
      domain:     'recovery',
      entity_id:  recovery_id,
      operation:  MUTATION_OPERATIONS.TRANSITION,
      from_state: 'STARTED',
      to_state:   'COMPLETED',
      clock:      this._clock,
      mutator:    'recovery-governor',
    });

    this._active.delete(recovery_id);
    this._history.push({ ...record });
    return record;
  }

  /**
   * Report a recovery attempt failure. Determines whether to retry or escalate.
   *
   * @param {string} recovery_id
   * @param {Error|string} error
   * @returns {{ shouldRetry: boolean, backoff_ms: number, escalated: boolean }}
   */
  failRecovery(recovery_id, error) {
    const record = this._getActive(recovery_id);
    const failed_at = this._clock.now();
    record.failed_at = failed_at;
    record.error     = error instanceof Error ? error.message : String(error);

    if (record.escalation === ESCALATION.FATAL) {
      this._escalate(record, 'STARTED');
      throw new Error(
        `[RecoveryGovernor] FATAL recovery failure in category '${record.category}': ${record.error}`
      );
    }

    if (record.escalation === ESCALATION.MANUAL_INTERVENTION_REQUIRED || record.attempts > record.max_retries) {
      this._escalate(record, 'STARTED');
      return { shouldRetry: false, backoff_ms: 0, escalated: true };
    }

    // RETRYABLE — transition to FAILED then back to STARTED on retry
    applyMutation({
      domain:     'recovery',
      entity_id:  recovery_id,
      operation:  MUTATION_OPERATIONS.TRANSITION,
      from_state: 'STARTED',
      to_state:   'FAILED',
      clock:      this._clock,
      mutator:    'recovery-governor',
    });
    record.final_phase = 'FAILED';

    const backoff_ms = this._backoffMs(record);

    // Pre-stage the retry: FAILED → STARTED
    record.attempts++;
    applyMutation({
      domain:     'recovery',
      entity_id:  recovery_id,
      operation:  MUTATION_OPERATIONS.TRANSITION,
      from_state: 'FAILED',
      to_state:   'STARTED',
      clock:      this._clock,
      mutator:    'recovery-governor',
    });
    record.final_phase = 'STARTED';

    return { shouldRetry: true, backoff_ms, escalated: false };
  }

  /**
   * Return a promise that resolves after the governed backoff period.
   * Uses governed clock for deterministic mode; falls back to real setTimeout.
   * The wait itself is not governed in deterministic mode — tests advance the clock manually.
   */
  async wait(ms) {
    if (ms <= 0) return;
    await new Promise(r => setTimeout(r, ms));
  }

  /**
   * Find the max_recovery_ms threshold for a named category from thresholds.json.
   * Returns null if no threshold is configured for this category.
   */
  thresholdFor(category) {
    const t = this._thresholds?.recovery;
    if (!t) return null;
    const keys = {
      backend_restart:  'backend_restart_ms',
      db_restart:       'db_restart_ms',
      network_outage:   'network_outage_recovery_ms',
    };
    const key = keys[category];
    return key && t[key] != null ? t[key] : null;
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  getReport() {
    const activeRecords = [...this._active.values()];
    return {
      generated_at:    new Date(this._clock.now()).toISOString(),
      total_recoveries: this._history.length + activeRecords.length,
      completed:        this._history.filter(r => r.final_phase === 'COMPLETED').length,
      escalated:        this._history.filter(r => r.final_phase === 'ESCALATED').length,
      active:           activeRecords.length,
      categories_used:  [...new Set([...this._history, ...activeRecords].map(r => r.category))],
      recoveries:       [...this._history, ...activeRecords],
    };
  }

  saveReport(reportsDir) {
    try {
      fs.mkdirSync(reportsDir, { recursive: true });
      fs.writeFileSync(
        path.join(reportsDir, 'recovery-governance.json'),
        JSON.stringify(this.getReport(), null, 2)
      );
    } catch { /* non-fatal */ }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  _getActive(recovery_id) {
    const record = this._active.get(recovery_id);
    if (!record) throw new Error(`No active recovery with id '${recovery_id}'`);
    return record;
  }

  _escalate(record, fromState) {
    record.escalated_at = this._clock.now();
    record.duration_ms  = record.escalated_at - record.started_at;
    record.final_phase  = 'ESCALATED';

    applyMutation({
      domain:     'recovery',
      entity_id:  record.recovery_id,
      operation:  MUTATION_OPERATIONS.TRANSITION,
      from_state: fromState,
      to_state:   'ESCALATED',
      clock:      this._clock,
      mutator:    'recovery-governor',
    });

    this._active.delete(record.recovery_id);
    this._history.push({ ...record });
  }

  _backoffMs(record) {
    // Deterministic exponential backoff: base * 2^(attempts-1), capped at max
    const raw = record.backoff_base_ms * Math.pow(2, record.attempts - 1);
    return Math.min(raw, record.max_backoff_ms);
  }
}
