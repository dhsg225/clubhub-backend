'use strict';
/**
 * trace-store/index.js
 *
 * Factory + exports for the Trace Store.
 * createTraceStore(deps) is the primary entry point.
 */

const { TraceStore }    = require('./trace-store');
const { TraceWriter }   = require('./trace-writer');
const { TraceReader }   = require('./trace-reader');
const { TraceIntegrity } = require('./trace-integrity');
const { TraceReplay }   = require('./trace-replay');
const {
  stableStringify,
  computeTraceId,
  computeTraceHash,
  buildEntry,
  verifyEntry,
  TRACE_FIELDS_ORDERED,
  GENESIS_HASH,
} = require('./trace-schema');

/**
 * createTraceStore({ pool })
 */
function createTraceStore({ pool }) {
  return new TraceStore({ pool });
}

module.exports = {
  createTraceStore,
  TraceStore,
  TraceWriter,
  TraceReader,
  TraceIntegrity,
  TraceReplay,
  // Schema utilities
  stableStringify,
  computeTraceId,
  computeTraceHash,
  buildEntry,
  verifyEntry,
  TRACE_FIELDS_ORDERED,
  GENESIS_HASH,
};
