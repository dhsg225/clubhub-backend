'use strict';
/**
 * ReplayCorruptionCertification
 *
 * RCC-01: adversarial-replay.js exists and exports AdversarialReplay
 * RCC-02: buildTrace() present
 * RCC-03: verifyTrace() present
 * RCC-04: replayCorruptedOrdering() present
 * RCC-05: replayPartialTrace() present
 * RCC-06: replayDuplicatedTrace() present
 * RCC-07: replayTamperedHash() present
 * RCC-08: functional — tampered hash rejected
 * RCC-09: functional — reordered trace rejected
 * RCC-10: functional — duplicated entry rejected
 * RCC-11: functional — valid trace passes
 * RCC-12: functional — partial valid prefix passes
 */
const fs   = require('fs');
const path = require('path');

const SIM_ROOT = path.resolve(__dirname, '..');

class ReplayCorruptionCertification {
  async run() {
    const static_checks = [
      this._exists('RCC-01', 'AdversarialReplay'),
      this._exists('RCC-02', 'buildTrace'),
      this._exists('RCC-03', 'verifyTrace'),
      this._exists('RCC-04', 'replayCorruptedOrdering'),
      this._exists('RCC-05', 'replayPartialTrace'),
      this._exists('RCC-06', 'replayDuplicatedTrace'),
      this._exists('RCC-07', 'replayTamperedHash'),
    ];

    const functional_checks = [
      this._tamperedHashRejected(),
      this._reorderedRejected(),
      this._duplicatedRejected(),
      this._validPasses(),
      this._partialPrefixPasses(),
    ];

    const checks = [...static_checks, ...functional_checks];
    return this._result('ReplayCorruptionCertification', checks);
  }

  // ——— Static ——————————————————————————————————————————————————

  _exists(id, marker) {
    const fp   = path.join(SIM_ROOT, 'adversarial-replay.js');
    const desc = `adversarial-replay.js has ${marker}`;
    if (!fs.existsSync(fp)) return { id, description: desc, status: 'FAIL', detail: 'adversarial-replay.js missing' };
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(marker)) return { id, description: desc, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description: desc, status: 'PASS', detail: null };
  }

  // ——— Functional ——————————————————————————————————————————————

  _makeReplayerAndTrace() {
    const { AdversarialReplay }  = require('../adversarial-replay');
    const { SimulationClock }    = require('../simulation-clock');
    const { SimulationEventBus } = require('../simulation-event-bus');
    const clock    = new SimulationClock();
    const eventBus = new SimulationEventBus(clock);
    const replayer = new AdversarialReplay(clock, eventBus);
    const raw      = Array.from({ length: 6 }, (_, i) => ({
      event_id:   `cert_evt_${i}`,
      event_type: 'test.audit',
      ts:         1_700_000_000_000 + i * 100,
      payload:    { step: i },
    }));
    const trace = replayer.buildTrace(raw);
    return { replayer, trace };
  }

  _tamperedHashRejected() {
    const id = 'RCC-08'; const desc = 'tampered hash rejected by verifyTrace';
    try {
      const { replayer, trace } = this._makeReplayerAndTrace();
      const result = replayer.replayTamperedHash(trace, 2);
      return result.rejected
        ? { id, description: desc, status: 'PASS', detail: null }
        : { id, description: desc, status: 'FAIL', detail: 'tampered hash was not rejected' };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _reorderedRejected() {
    const id = 'RCC-09'; const desc = 'reordered trace rejected by verifyTrace';
    try {
      const { replayer, trace } = this._makeReplayerAndTrace();
      const result = replayer.replayCorruptedOrdering(trace);
      return result.rejected
        ? { id, description: desc, status: 'PASS', detail: null }
        : { id, description: desc, status: 'FAIL', detail: 'reordered trace was accepted' };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _duplicatedRejected() {
    const id = 'RCC-10'; const desc = 'duplicated entry rejected by verifyTrace';
    try {
      const { replayer, trace } = this._makeReplayerAndTrace();
      const result = replayer.replayDuplicatedTrace(trace, 1);
      return result.rejected
        ? { id, description: desc, status: 'PASS', detail: null }
        : { id, description: desc, status: 'FAIL', detail: 'duplicated trace was accepted' };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _validPasses() {
    const id = 'RCC-11'; const desc = 'valid trace passes verifyTrace';
    try {
      const { replayer, trace } = this._makeReplayerAndTrace();
      const result = replayer.verifyTrace(trace);
      return result.valid
        ? { id, description: desc, status: 'PASS', detail: null }
        : { id, description: desc, status: 'FAIL', detail: `valid trace failed: ${result.reason}` };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _partialPrefixPasses() {
    const id = 'RCC-12'; const desc = 'partial valid prefix passes verifyTrace';
    try {
      const { replayer, trace } = this._makeReplayerAndTrace();
      const result = replayer.replayPartialTrace(trace, 3);
      return result.valid
        ? { id, description: desc, status: 'PASS', detail: null }
        : { id, description: desc, status: 'FAIL', detail: `partial prefix failed: ${result.reason}` };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ReplayCorruptionCertification };
