# ClubHub TV — Failure Classification Rules

Decision tree for classifying any observed failure.

## Step 1 — Is corpus integrity unverifiable or is an active emergency overlapping CLASS_4?

YES → CLASS_5 (System Halt). Stop here.

## Step 2 — Is any of the following true?

- CLASS_4 shadow divergence observed
- Corpus hash verification failure
- Replay harness produces non-deterministic output for same packet
- Emergency active AND resolution_level !== 0 (INV-7 violation)

YES → CLASS_4 (Catastrophic). Halt canary immediately, all-stop. Stop here.

## Step 3 — Is any of the following true?

- Invariant violation detected (InvariantViolationError thrown)
- Corpus replay divergence (expected vs actual hash mismatch)
- Shadow parity_score_24h < 0.999
- CLASS_3 shadow divergence

YES → CLASS_3 (Constitutional Violation). Halt canary, alert operator, serve legacy only. Stop here.

## Step 4 — Is any of the following true?

- Shadow subsystem unavailable
- Entropy subsystem unavailable
- Audit writer unavailable
- DB active schedules empty (all inactive)

YES → CLASS_2 (Partial Subsystem Failure). Alert operator, PRE continues. Stop here.

## Step 5 — Is PRE resolution latency > 200ms p95 but output is correct?

YES → CLASS_1 (Performance Degradation). Monitor, no state change. Stop here.

## Step 6 — All systems nominal?

YES → CLASS_0 (Normal Operation).

---

## Tie-Breaking Rules

- When multiple classes apply simultaneously, apply the highest class.
- A CLASS_2 subsystem failure never escalates PRE to fallback on its own.
- A CLASS_1 latency issue never causes canary halt.
- CLASS_3 and above always require human review before clearing.
- Only CLASS_4 auto-triggers canary halt without human confirmation.
