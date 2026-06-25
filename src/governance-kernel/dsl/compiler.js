'use strict';
const crypto = require('node:crypto');
const SEVERITY_LEVELS = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function _compileCondition(stmt) {
  const { subject, operator, value } = stmt;
  return function evaluate(ctx) {
    let ctxVal = ctx;
    for (const p of subject.split('.')) ctxVal = ctxVal?.[p];
    const num = SEVERITY_LEVELS[ctxVal] ?? ctxVal;
    const ref = SEVERITY_LEVELS[value]  ?? value;
    switch (operator) {
      case '>=': return num >= ref;
      case '<=': return num <= ref;
      case '>':  return num >  ref;
      case '<':  return num <  ref;
      case '==': return num == ref;
      case '!=': return num != ref;
      default:   return false;
    }
  };
}

function compile(ast) {
  return ast.domains.map(domain => {
    const policy = {
      domain:            domain.name,
      freeze_conditions: [],
      requirements:      [],
      resource_ceilings: {},
      permissions:       [],
      policy_refs:       [],
    };
    for (const stmt of domain.statements) {
      if      (stmt.type === 'freeze_on')       policy.freeze_conditions.push({ ...stmt, evaluate: _compileCondition(stmt) });
      else if (stmt.type === 'require')          policy.requirements.push(stmt.requirement);
      else if (stmt.type === 'resource_ceiling') policy.resource_ceilings[stmt.resource] = stmt.limit;
      else if (stmt.type === 'permission')       policy.permissions.push({ action: stmt.action, target: stmt.target });
      else if (stmt.type === 'policy_ref')       policy.policy_refs.push(stmt.name);
    }
    const canonical = JSON.stringify({
      domain: policy.domain,
      freeze_conditions: policy.freeze_conditions.map(c => ({ subject: c.subject, operator: c.operator, value: c.value })),
      requirements: policy.requirements,
      resource_ceilings: policy.resource_ceilings,
    });
    policy.content_hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    policy.compiled_at  = new Date().toISOString();
    return policy;
  });
}

module.exports = { compile };
