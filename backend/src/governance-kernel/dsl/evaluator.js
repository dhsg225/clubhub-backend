'use strict';
function _checkRequirement(req, context) {
  switch (req) {
    case 'lineage.strict':             return context.lineageMode === 'STRICT';
    case 'replayable':                 return context.replayable !== false;
    case 'authority.db_authoritative': return ['DB_AUTHORITATIVE','LINEARIZED'].includes(context.authorityLevel);
    case 'authority.linearized':       return context.authorityLevel === 'LINEARIZED';
    case 'ha.active_active':           return context.haTopology === 'ACTIVE_ACTIVE_WRITES';
    default:                           return true;
  }
}

function evaluate(compiledPolicy, context) {
  const evidence = [];
  let shouldFreeze = false;
  for (const c of compiledPolicy.freeze_conditions) {
    const triggered = c.evaluate(context);
    evidence.push({ type: 'freeze_condition', subject: c.subject, operator: c.operator, value: c.value, triggered });
    if (triggered) shouldFreeze = true;
  }
  const unmet = [];
  for (const req of compiledPolicy.requirements) {
    const met = _checkRequirement(req, context);
    evidence.push({ type: 'requirement', requirement: req, met });
    if (!met) unmet.push(req);
  }
  const violations = [];
  for (const [resource, ceiling] of Object.entries(compiledPolicy.resource_ceilings)) {
    const current  = context.resources?.[resource] ?? 0;
    const violated = current > ceiling;
    evidence.push({ type: 'resource_ceiling', resource, ceiling, current, violated });
    if (violated) violations.push(resource);
  }
  return Object.freeze({
    domain:              compiledPolicy.domain,
    policy_hash:         compiledPolicy.content_hash,
    should_freeze:       shouldFreeze,
    unmet_requirements:  unmet,
    resource_violations: violations,
    outcome:             shouldFreeze ? 'FREEZE' : unmet.length ? 'BLOCKED' : violations.length ? 'CAPPED' : 'PASS',
    evidence,
    evaluated_at:        new Date().toISOString(),
  });
}
module.exports = { evaluate };
