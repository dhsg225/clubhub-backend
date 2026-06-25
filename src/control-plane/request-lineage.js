'use strict';
/**
 * request-lineage.js — assigns and propagates lineage context for every control plane request.
 */

class RequestLineage {
  constructor() { this._seq = 0; }

  _next() { return `cp_req_${++this._seq}`; }

  tag(req, opts = {}) {
    return {
      ...req,
      correlation_id:   opts.correlation_id ?? req.correlation_id ?? this._next(),
      lineage_ts:       opts.lineage_ts     ?? req.lineage_ts     ?? Date.now(),
      request_id:       this._next(),
      source:           opts.source         ?? 'CONTROL_PLANE',
    };
  }

  extract(taggedReq) {
    return {
      correlation_id: taggedReq.correlation_id,
      lineage_ts:     taggedReq.lineage_ts,
      request_id:     taggedReq.request_id,
      source:         taggedReq.source,
    };
  }
}

module.exports = { RequestLineage };
