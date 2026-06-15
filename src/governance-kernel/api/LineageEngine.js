'use strict';
const lineage = require('../core/lineage');

class LineageEngine {
  withLineage(eventFields, ctx)       { return lineage.withLineage(eventFields, ctx); }
  verifyLineage(events, opts)         { return lineage.verifyLineage(events, opts); }
  exportLineage(dir)                  { return lineage.exportLineage(dir); }
  get MODES()                         { return lineage.LINEAGE_MODES; }
  get ANOMALY()                       { return lineage.LINEAGE_ANOMALY; }
}
module.exports = { LineageEngine };
