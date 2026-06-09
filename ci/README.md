# ci/ — Constitutional CI Gates

## Constitutional Role

Defines the 8-stage CI pipeline that makes constitutional rules automatically enforced
on every pull request. Failing gates block merge — they are not advisory warnings.

Defined in: `docs/EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §11`

## Ownership

**Owner:** Platform team
**Write policy:** PR + **two reviewers** always.

## Pipeline Stages

| Stage | File | Blocking | Purpose |
|-------|------|----------|---------|
| 01 | `stages/01-schema-validate.yml` | Yes | JSON schema validation for corpus packets |
| 02 | `stages/02-replay-corpus.yml` | Yes | Full corpus replay against current PRE |
| 03 | `stages/03-invariant-verify.yml` | Yes | INV-1 through INV-10 assertions |
| 04 | `stages/04-threshold-scan.yml` | Yes | Detect hardcoded threshold values (FP-07) |
| 05 | `stages/05-forbidden-pattern.yml` | Yes | FP-01 through FP-15 static analysis |
| 06 | `stages/06-migration-lint.yml` | Yes | SQL migration constitutional linting |
| 07 | `stages/07-parity-verify.yml` | Advisory | Shadow-mode parity score check (Phase 5+) |
| 08 | `stages/08-chaos-smoke.yml` | Yes | Chaos scenario smoke validation |

## Emergency Bypass Protocol

Emergency bypasses are permitted only with:
1. Written justification committed to `ci/bypass-audit.ts` log
2. Second engineer approval
3. Post-incident review within 48 hours

Bypassing without this record = CONSTITUTIONAL_BREACH.

## Files

| File | Purpose |
|------|---------|
| `gates.ts` | Gate evaluation logic — determines blocking vs advisory |
| `bypass-audit.ts` | Emergency bypass record and audit trail |
| `artifact-retention.ts` | Replay run artifact retention policy |
