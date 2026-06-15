'use strict';
const core = require('../core/incident-manager');

class IncidentManager {
  async init(pool)                       { return core.initFromDb?.(pool); }
  async create(type, severity, chain)    { return core.createIncident(type, severity, chain); }
  async transition(id, toState, reason)  { return core.transition(id, toState, reason); }
  async transitionStrong(pool, id, toState, reason) { return core.transitionStrong(pool, id, toState, reason); }
  get(id)                                { return core.getIncident(id); }
  getActive()                            { return core.getActiveIncidents(); }
  async archive(id)                      { return core.archiveIncident(id); }
  async archiveResolved(pool)            { return core.archiveResolvedIncidents?.(pool); }
  get STATES()                           { return core.INCIDENT_STATES; }
}
module.exports = { IncidentManager };
