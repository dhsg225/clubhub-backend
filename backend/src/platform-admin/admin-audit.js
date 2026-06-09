'use strict';
/**
 * AdminAudit — append-only log of all admin actions.
 */

class AdminAudit {
  constructor() {
    this._entries = [];
    this._seq     = 0;
  }

  record(action, operatorId, details = {}) {
    const entry = {
      entry_id:    `admin_audit_${++this._seq}`,
      action,
      operator_id: operatorId,
      details,
      recorded_at: Date.now(),
    };
    this._entries.push(Object.freeze(entry));
    return entry;
  }

  getEntries()          { return [...this._entries]; }
  getByAction(action)   { return this._entries.filter(e => e.action === action); }
  getByOperator(opId)   { return this._entries.filter(e => e.operator_id === opId); }

  snapshot() {
    return { entry_count: this._entries.length, entries: this.getEntries() };
  }
}

module.exports = { AdminAudit };
