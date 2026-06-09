'use strict';
/**
 * FaultInjector — reversible fault injection for governed simulation.
 *
 * H5: Every fault is reversible via its returned restore() function.
 * H6: Injected faults never reach production state — simulation layer only.
 *
 * Methods:
 *   injectClockSkew(node, skewMs)          → { faultId, restore }
 *   injectNetworkPartition(bus, nA, nB)    → { faultId, restore }
 *   injectReplayCorruption(trace, opts)    → { faultId, corrupted, original, restore }
 *   injectDroppedEvents(bus, rate, prng)   → { faultId, restore, getDropCount }
 *   injectDelayedConsensus(cluster, ms)    → { faultId, restore }
 *   injectLedgerTampering(ledger, idx, v)  → { faultId, restore, tampered }
 *   restoreAll()                           → restore all active faults
 *   getActiveFaults()                      → list of active fault descriptors
 */
const crypto = require('node:crypto');

class FaultInjector {
  constructor() {
    this._active = new Map(); // faultId → { type, restore }
    this._seq    = 0;
  }

  // ——— Clock Skew ——————————————————————————————————————————————————

  /**
   * Apply a deterministic clock offset to a simulation node.
   * node.clockOffset is read by SimulationCluster.nodeNow(id).
   */
  injectClockSkew(node, skewMs) {
    const faultId   = this._id('clock_skew');
    const origSkew  = node.clockOffset ?? 0;
    node.clockOffset = skewMs;

    const restore = () => {
      node.clockOffset = origSkew;
      this._active.delete(faultId);
    };
    this._active.set(faultId, { type: 'clock_skew', node_id: node.id, skewMs, restore });
    return { faultId, restore };
  }

  // ——— Network Partition ———————————————————————————————————————————

  /**
   * Inject bidirectional network partition between nodeA and nodeB on bus.
   */
  injectNetworkPartition(bus, nodeA, nodeB) {
    const faultId = this._id('net_partition');
    bus.addPartition(nodeA, nodeB);

    const restore = () => {
      bus.removePartition(nodeA, nodeB);
      this._active.delete(faultId);
    };
    this._active.set(faultId, { type: 'network_partition', nodeA, nodeB, restore });
    return { faultId, restore };
  }

  // ——— Replay Corruption ———————————————————————————————————————————

  /**
   * Return a corrupted copy of trace without mutating original.
   *
   * opts.mode:
   *   'tamper_hash'  — modify hash/prev_hash at index (default)
   *   'reorder'      — swap first two events
   *   'duplicate'    — duplicate event at index
   *   'truncate'     — cut trace to keepCount (default: half)
   *
   * restore() returns original trace.
   */
  injectReplayCorruption(trace, opts = {}) {
    const faultId  = this._id('replay_corruption');
    const original = JSON.parse(JSON.stringify(trace));
    const { mode = 'tamper_hash', index = 0 } = opts;
    const corrupted = JSON.parse(JSON.stringify(trace));

    switch (mode) {
      case 'tamper_hash':
        if (corrupted[index]) {
          corrupted[index] = {
            ...corrupted[index],
            hash: 'CORRUPTED_' + faultId,
            prev_hash: corrupted[index].prev_hash ? 'CORRUPTED_PREV_' + faultId : undefined,
          };
        }
        break;

      case 'reorder':
        if (corrupted.length > 1) {
          [corrupted[0], corrupted[1]] = [corrupted[1], corrupted[0]];
        }
        break;

      case 'duplicate': {
        const src = corrupted[index];
        if (src) {
          corrupted.splice(index + 1, 0, {
            ...src,
            event_id:  src.event_id + '_DUP',
            hash:      src.hash ? 'DUP_' + src.hash : undefined,
          });
        }
        break;
      }

      case 'truncate': {
        const keep = opts.keepCount ?? Math.max(1, Math.floor(corrupted.length / 2));
        corrupted.length = keep;
        break;
      }

      default:
        throw new Error(`Unknown corruption mode: ${mode}`);
    }

    const restore = () => { this._active.delete(faultId); return original; };
    this._active.set(faultId, { type: 'replay_corruption', mode, restore });
    return { faultId, corrupted, original, restore };
  }

  // ——— Dropped Events ——————————————————————————————————————————————

  /**
   * Wrap bus.emit to probabilistically drop events.
   * prng — deterministic PRNG function (caller supplies for H1 guarantee).
   * dropRate — 0.0–1.0 fraction to drop.
   *
   * NOTE: This patches the bus instance; restore() undoes the patch.
   */
  injectDroppedEvents(bus, dropRate = 0.5, prng = null) {
    if (dropRate < 0 || dropRate > 1) throw new RangeError(`dropRate must be 0–1; got ${dropRate}`);
    const faultId     = this._id('dropped_events');
    const origEmit    = bus.emit.bind(bus);
    const _prng       = prng ?? (() => 0.5); // safe default: always drops at 0.5 rate if no prng
    let dropCount     = 0;

    bus.emit = function injectedEmit(eventType, fields, opts = {}) {
      if (_prng() < dropRate) { dropCount++; return null; }
      return origEmit(eventType, fields, opts);
    };

    const restore = () => { bus.emit = origEmit; this._active.delete(faultId); };
    this._active.set(faultId, { type: 'dropped_events', dropRate, restore });
    return { faultId, restore, getDropCount: () => dropCount };
  }

  // ——— Delayed Consensus ———————————————————————————————————————————

  /**
   * Add artificial consensus delay to cluster (used in epoch propagation scenarios).
   */
  injectDelayedConsensus(cluster, delayMs) {
    const faultId  = this._id('delayed_consensus');
    const original = cluster.consensusDelayMs ?? 0;
    cluster.consensusDelayMs = delayMs;

    const restore = () => {
      cluster.consensusDelayMs = original;
      this._active.delete(faultId);
    };
    this._active.set(faultId, { type: 'delayed_consensus', delayMs, restore });
    return { faultId, restore };
  }

  // ——— Ledger Tampering ————————————————————————————————————————————

  /**
   * Mutate a ledger entry's hash at idx.
   * ledger.entries must be an array of mutable objects.
   * restore() reverts to original entry.
   */
  injectLedgerTampering(ledger, idx, tamperValue = null) {
    const faultId = this._id('ledger_tamper');

    if (!Array.isArray(ledger?.entries) || idx >= ledger.entries.length) {
      const noop = () => { this._active.delete(faultId); };
      this._active.set(faultId, { type: 'ledger_tamper', tampered: false, restore: noop });
      return { faultId, restore: noop, tampered: false };
    }

    const original = Object.assign({}, ledger.entries[idx]);
    ledger.entries[idx] = {
      ...ledger.entries[idx],
      hash: tamperValue ?? ('TAMPERED_' + faultId),
    };

    const restore = () => {
      ledger.entries[idx] = original;
      this._active.delete(faultId);
    };
    this._active.set(faultId, { type: 'ledger_tamper', idx, tampered: true, restore });
    return { faultId, restore, tampered: true };
  }

  // ——— Management ——————————————————————————————————————————————————

  /** Restore all active faults in insertion order. */
  restoreAll() {
    for (const f of [...this._active.values()]) {
      try { f.restore(); } catch { /* safe */ }
    }
    this._active.clear();
  }

  /** Descriptors of currently active faults (no restore refs). */
  getActiveFaults() {
    return [...this._active.values()].map(({ restore: _, ...rest }) => rest);
  }

  getActiveFaultCount() { return this._active.size; }

  // ——— Private ——————————————————————————————————————————————————————

  _id(type) { return `${type}_${++this._seq}`; }
}

module.exports = { FaultInjector };
