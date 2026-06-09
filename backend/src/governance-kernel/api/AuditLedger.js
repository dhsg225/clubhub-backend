'use strict';
const core = require('../core/audit-ledger');

class AuditLedger {
  appendEntry(opts)                   { return core.appendEntry(opts); }
  async appendLinearized(pool, opts)  { return core.appendEntryLinearized(pool, opts); }
  getEntries()                        { return core.getEntries(); }
  verifyIntegrity()                   { return core.verifyIntegrity(); }
  save(dir)                           { return core.saveLedger(dir); }
  reset()                             { return core.resetLedger(); }
  get ALLOWED_TYPES()                 { return core.ALLOWED_ACTION_TYPES; }
}
module.exports = { AuditLedger };
