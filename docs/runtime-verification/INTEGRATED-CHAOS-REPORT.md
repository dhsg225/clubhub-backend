# Integrated Chaos Report

**Phase:** G.4 — Full-Stack Chaos Validation
**Date:** 2026-05-26
**Stack:** PRE engine + cms-api + player validation logic

---

## What Is Proven

### PRE-Layer Chaos (8 Scenarios × 100 Runs Each)
All 8 chaos scenarios are deterministic (100 runs each, zero variance):

| Scenario | Description | Expected Level | Result |
|----------|-------------|----------------|--------|
| CHAOS-G4-001 | Empty state | LEVEL_5 fallback | PASS |
| CHAOS-G4-002 | Emergency active (with full schedule) | LEVEL_0 | PASS |
| CHAOS-G4-003 | Inactive emergency | LEVEL_5 (emergency ignored) | PASS |
| CHAOS-G4-004 | Inactive screen | Any (no crash) | PASS |
| CHAOS-G4-005 | Maintenance screen | Any (no crash) | PASS |
| CHAOS-G4-006 | Campaign with no content | LEVEL_5 fallback | PASS |
| CHAOS-G4-007 | Expired override (skipped) | LEVEL_5 fallback | PASS |
| CHAOS-G4-008 | Sponsorship SOV > 100% | L4 guard/clamp | PASS |

### Emergency Override Absolutism
- Emergency active with competing schedules: ALWAYS LEVEL_0
- Inactive emergency: completely ignored, normal resolution proceeds
- Verified: no schedule, campaign, or override can suppress a LEVEL_0 emergency

### PRE Crash Safety
- PRE.resolve() does NOT throw on any degraded state
- All edge cases (no campaigns, orphaned campaigns, expired overrides, over-SOV)
  produce deterministic outputs without exceptions

### Invariants Under Chaos
- All 10 constitutional invariants pass under all 8 degraded states
- InvariantViolationError never thrown in chaos scenarios

### API-Layer Chaos
- Malformed response bodies: correctly rejected by player validation logic
- Unknown screen_id: returns 404 (not 500 or 200 with garbage)
- Sequential requests post-chaos: stable checksums restored

---

## What Remains Unproven

- Network partition between API and DB (requires Docker network manipulation)
- DB replica lag during writes (not applicable to current single-node setup)
- Simultaneous emergency activation mid-request
- OOM/process-kill scenarios requiring systemd restart validation

---

## Scripts
```bash
tsx scripts/validation/integrated-chaos.ts
API_URL=http://localhost:3000 tsx scripts/validation/outage-recovery.ts
DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/degraded-state-audit.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED
