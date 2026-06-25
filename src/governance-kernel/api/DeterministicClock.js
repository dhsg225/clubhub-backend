'use strict';
const clock = require('../core/clock');

class DeterministicClock {
  now()            { return clock.now(); }
  nowIso()         { return clock.nowIso(); }
  monotonic()      { return clock.monotonic(); }
  freeze()         { clock.freeze(); }
  unfreeze()       { clock.unfreeze(); }
  setOffset(ms)    { clock.setOffset(ms); }
  setFixed(epochMs){ clock.setFixed(epochMs); }
  isFrozen()       { return clock.isFrozen(); }
  reset()          { clock._reset(); }
}
module.exports = { DeterministicClock };
