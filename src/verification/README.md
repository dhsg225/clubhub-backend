# src/verification/ — Verification Runtime

## Constitutional Role

This directory contains the executable enforcement layer for PRE correctness. It proves the
PRE implementation is constitutionally compliant using:

1. **Replay harness** — executes corpus packets against the current PRE implementation
2. **Invariant engine** — asserts INV-1 through INV-10 on every PRE invocation
3. **Divergence classifier** — classifies behavioral differences as cosmetic/tolerated/warning/constitutional/catastrophic
4. **Parity runner** — dual-execution shadow mode with canary promotion gates
5. **Production monitors** — scheduled queries detecting FORBIDDEN states

## Ownership

**Owner:** Platform team
**Write policy:** PR + second reviewer always for `invariants/`.

## Key Rule

This directory MUST NOT modify any production state. All verification is read-only.
Invariant violations are reported and escalated — never auto-corrected.

## Directory Structure

```
verification/
├── invariants/           # INV-1 through INV-10 as executable assertions
├── replay/               # Replay harness, packet loader, in-memory DB, comparator
├── parity/               # Shadow-mode runner, parity scorer, canary gate
├── divergence/           # Divergence classifier and diff engine
└── production-monitors/  # FORBIDDEN state monitors and version monotonicity checks
```

## Failure Semantics

- `InvariantViolationError` = CONSTITUTIONAL_BREACH — cannot be caught and suppressed
- `INTEGRITY_FAILURE` at packet load = distinct from BEHAVIORAL_DIVERGENCE
- Class 3 (constitutional) or Class 4 (catastrophic) divergence = blocks deploy
- All failures emit structured telemetry to `src/observability/`
