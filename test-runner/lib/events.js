/**
 * Event correlation utilities.
 *
 * Every governed event ingested by MetricsCollector receives a unique
 * correlation_id and an optional caused_by link to the chaos mark that
 * triggered it. This enables full causal-chain reconstruction for any
 * threshold breach.
 *
 * correlation_ids are sequential counters (not timestamps) so they are
 * stable across replay runs and comparable between original and replay.
 */

let _seq = 0;

/**
 * Reset the sequence counter. Called between runs in test environments.
 */
export function resetSequence() {
  _seq = 0;
}

/**
 * Generate a monotonically-unique, deterministic correlation ID.
 * Format: cid-XXXXXXXX (zero-padded hex sequence).
 */
export function newCorrelationId() {
  return `cid-${(++_seq).toString(16).padStart(8, '0')}`;
}

/**
 * Enrich a raw simulator event with correlation metadata.
 *
 * @param {object} event     Raw event from the fleet simulator
 * @param {object} options
 *   correlation_id  Override the generated ID (optional)
 *   caused_by       correlation_id of the chaos mark causing this event (or null)
 *   suite           Active suite name at ingestion time
 * @returns Enriched event object with correlation_id, caused_by, suite fields.
 */
export function enrichEvent(event, options = {}) {
  return {
    ...event,
    correlation_id: options.correlation_id ?? newCorrelationId(),
    caused_by:      options.caused_by      ?? null,
    suite:          options.suite          ?? null,
  };
}
