# CERTIFICATION_FAILURE_PLAYBOOK.md
# Operator Playbook — Certification Failure Response

## Preconditions
- A certification runner returns FAIL on one or more checks
- Detected during CI or manual run

## Required authority
- Role: ADMIN (code changes require engineer access)

## Commands

```bash
# 1. Run full certification suite:
node -e "
const { GovernanceCertificationRunner } = require('./governance-kernel');
const { certifyUI } = require('./governance-kernel/operator-ui');
const { createOTARuntime } = require('./plugins/ota-runtime');
Promise.all([
  new GovernanceCertificationRunner().run(),
  certifyUI(),
  createOTARuntime().certifyRuntime(),
]).then(([k,ui,rt]) => {
  [k,ui,rt].forEach(r => {
    if (r.fail_count > 0 || r.fail_count === undefined) {
      const results = r.results || [];
      results.forEach(s => s.checks.filter(c=>c.status==='FAIL').forEach(c=>console.log(s.name,c.id,c.detail)));
    }
  });
}).catch(e=>console.error(e.message));
"

# 2. Identify failing check — note check ID (e.g., ABC-06, UIC-03)
# 3. Navigate to failing file based on check description
# 4. Fix the violation
# 5. Re-run targeted certification suite
# 6. Re-run full suite to confirm no regressions
```

## Expected events
- No runtime events — certification is static analysis
- CI gate blocks merge on any FAIL

## Rollback procedures
- Revert the code change that introduced the FAIL
- Verify the revert restores all certifications to their previous state
- Do NOT suppress checks or change certification to report PASS for wrong reasons

## Failure escalation
- FAIL on `AuthorityBypassCertification`: authority boundary violated — HIGH severity; no deployment
- FAIL on `ReplayIsolationCertification`: replay isolation broken — HIGH severity; no deployment
- FAIL on `UIConsistencyCertification` UIC-03: optimistic LINEARIZED update introduced — CRITICAL

## Replay implications
- Certification failures do not affect event history
- Can use replay forensics to identify when a violation was introduced (if recorded)

## Certification implications
- A new FAIL is a hard block on deployment
- CONDITIONAL is advisory; document the caveat and proceed with awareness
- Never silence a check to make it PASS without fixing the underlying issue
