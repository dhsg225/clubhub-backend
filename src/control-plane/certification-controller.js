'use strict';
const { buildResponse } = require('./api-contracts');

class CertificationController {
  constructor({ certRunners = {} } = {}) {
    // certRunners: { a7: certifyA7, a8: certifyA8, a9: certifyA9, a10: certifyA10 }
    this._runners = certRunners;
  }

  async runCertification(phase) {
    const runner = this._runners[phase.toLowerCase()];
    if (!runner) return buildResponse(false, `no certification runner for phase '${phase}'`);
    try {
      const result = await runner();
      return buildResponse(true, result);
    } catch (err) {
      return buildResponse(false, err.message);
    }
  }

  listPhases() {
    return buildResponse(true, { phases: Object.keys(this._runners) });
  }
}

module.exports = { CertificationController };
