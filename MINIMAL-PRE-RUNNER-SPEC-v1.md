# MINIMAL-PRE-RUNNER-SPEC-v1

**Status:** AUTHORITATIVE
**Scope:** Smallest PRE system that accepts input, produces deterministic output, emits observable trace, and can be replayed identically

---

## 1. INPUT SCHEMA

```typescript
interface PREInput {
  // Identity
  resolution_id: string;        // deterministic ID: hash(scope_id + governed_timestamp)
  scope_id: string;             // screen_id | venue_id | fleet
  governed_timestamp: string;   // ISO8601 from GovernedClock — wall clock forbidden

  // State inputs (complete snapshot; all required for corpus storage)
  rule_version: string;         // semver; pinned at resolution time
  override_stack: Override[];   // ordered by priority descending
  schedule_block: ScheduleBlock | null;
  emergency_active: boolean;
  emergency_scope: string | null;
  device_state: 'ONLINE' | 'OFFLINE' | 'DEGRADED';

  // Corpus linkage
  corpus_entry_id?: string;     // present when replaying; absent in live resolution
}

interface Override {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;  // 6 = highest priority
  content_ref: string;
  expires_at: string | null;        // GovernedClock ISO8601
  operator_id: string;
}

interface ScheduleBlock {
  content_ref: string;
  starts_at: string;    // GovernedClock ISO8601
  ends_at: string;      // GovernedClock ISO8601
}
```

---

## 2. OUTPUT SCHEMA

```typescript
interface PREOutput {
  // Identity
  resolution_id: string;        // echoed from input
  scope_id: string;
  governed_timestamp: string;
  rule_version: string;

  // Result
  effective_content: string;    // content_ref of winning content
  resolution_level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // 0 = schedule base; 1-6 = override level that won
  resolution_winner_id: string | null;  // override.id that won; null if schedule won

  // Resolution path (required; must be complete)
  resolution_path: ResolutionStep[];

  // Trace
  trace_id: string;             // unique per resolution; used for observability correlation
  computed_at: string;          // GovernedClock ISO8601
  input_hash: string;           // SHA-256 of canonical serialized PREInput
  output_hash: string;          // SHA-256 of canonical serialized PREOutput (excluding this field)
}

interface ResolutionStep {
  step: number;                 // 1-indexed; ordered
  evaluated: string;            // what was evaluated (override id or 'schedule' or 'emergency')
  result: 'WIN' | 'SUPPRESSED' | 'EXPIRED' | 'OUT_OF_SCOPE';
  reason: string;               // machine-readable reason code
}
```

---

## 3. EXECUTION STEPS (numbered, deterministic, pure)

The resolution function is pure. No I/O, no side effects, no external reads.

```
Step 1: Validate input
  - All required fields present
  - governed_timestamp is not in the future relative to caller's GovernedClock
  - rule_version matches loaded rule set
  - Failure → emit PREFailure (see Section 6); halt

Step 2: Check emergency
  - If emergency_active AND (scope_id matches emergency_scope OR emergency_scope == 'fleet'):
    → effective_content = EMERGENCY_CONTENT_REF
    → resolution_level = 6
    → resolution_winner_id = 'EMERGENCY'
    → resolution_path = [{ step:1, evaluated:'emergency', result:'WIN', reason:'EMERGENCY_ACTIVE' }]
    → skip to Step 6

Step 3: Walk override stack (highest level first)
  For each override in override_stack sorted by level descending, then by id ascending (tie-break):
    3a. If override.expires_at is not null AND override.expires_at <= governed_timestamp:
        → append ResolutionStep { result:'EXPIRED', reason:'TTL_EXPIRED' }
        → continue to next
    3b. If override.level < current highest winning level already found:
        → append ResolutionStep { result:'SUPPRESSED', reason:'LOWER_PRIORITY' }
        → continue to next
    3c. This override wins provisionally:
        → record winning_override = this override
        → append ResolutionStep { result:'WIN', reason:'OVERRIDE_LEVEL_' + level }
        → break (first win at highest level terminates search)

Step 4: Fall through to schedule
  If no override won in Step 3:
    If schedule_block is not null
      AND schedule_block.starts_at <= governed_timestamp
      AND schedule_block.ends_at > governed_timestamp:
        → winning_content = schedule_block.content_ref
        → resolution_level = 0
        → resolution_winner_id = null
        → append ResolutionStep { step:N, evaluated:'schedule', result:'WIN', reason:'SCHEDULE_ACTIVE' }
    Else:
        → emit PREFailure reason:'NO_CONTENT_RESOLVED'
        → halt

Step 5: Set output fields from winning content
  - effective_content = winning override's content_ref OR schedule_block.content_ref
  - resolution_level = winning override's level OR 0
  - resolution_winner_id = winning override's id OR null

Step 6: Compute hashes and trace
  - input_hash = SHA-256(canonicalJSON(input))  // keys sorted; no whitespace
  - Assemble PREOutput (all fields except output_hash)
  - output_hash = SHA-256(canonicalJSON(assembledOutput))
  - trace_id = deterministic: hash(resolution_id + computed_at + input_hash)

Step 7: Emit trace event (side effect, executed by runtime after pure function returns)
  - See Section 4

Step 8: Return PREOutput
```

**Canonical JSON serialization:** Object keys sorted lexicographically, no whitespace, no trailing newlines. This rule applies wherever `canonicalJSON()` is called.

---

## 4. TRACE EMISSION FORMAT

Emitted by the runtime after the pure resolution function returns. Not inside the resolution function.

```typescript
interface PRETraceEvent {
  event_type: 'PRE_RESOLVED' | 'PRE_FAILED';
  trace_id: string;
  resolution_id: string;
  scope_id: string;
  governed_timestamp: string;
  rule_version: string;
  input_hash: string;
  output_hash: string;             // absent on PRE_FAILED
  resolution_level: number;        // absent on PRE_FAILED
  effective_content: string;       // absent on PRE_FAILED
  resolution_path_length: number;  // count of steps; absent on PRE_FAILED
  failure_reason?: string;         // present on PRE_FAILED only
  emitted_at: string;              // GovernedClock ISO8601
  corpus_entry_id?: string;        // present when replaying
}
```

Trace events are append-only. They must never be modified after emission.

---

## 5. REPLAY VERIFICATION METHOD

To verify that a replay produces the same result as the original execution:

```
1. Load corpus entry: retrieve PREInput and recorded PREOutput for corpus_entry_id
2. Run PRE resolution on the stored PREInput with the stored rule_version
3. Compute input_hash of the stored input → must equal stored PREOutput.input_hash
4. Compute output_hash of the new output (excluding output_hash field) → must equal stored PREOutput.output_hash
5. Compare resolution_path step-by-step → every step.result and step.reason must match
6. PASS: all three match (input_hash, output_hash, resolution_path)
   FAIL: any mismatch → classify failure per Section 6
```

Replay verification must not use the new output's output_hash to verify itself — the hash is verified by recomputation, not by self-reference.

---

## 6. FAILURE CONDITIONS

| Code | Condition | Action |
|------|-----------|--------|
| `INVALID_INPUT` | Required field missing or malformed | Emit PRETraceEvent(PRE_FAILED); return error; do not produce PREOutput |
| `RULE_VERSION_MISMATCH` | requested rule_version not available | Emit PRETraceEvent(PRE_FAILED); return error |
| `NO_CONTENT_RESOLVED` | Emergency inactive; no winning override; no active schedule block | Emit PRETraceEvent(PRE_FAILED); return error |
| `CLOCK_VIOLATION` | governed_timestamp is in the future | Emit PRETraceEvent(PRE_FAILED); return error |
| `DETERMINISM_VIOLATION` | output_hash differs across runs for same input | Emit PRETraceEvent(PRE_FAILED) with both hashes; halt process; block deployment |
| `CORPUS_DIVERGENCE` | replay output_hash differs from corpus-recorded output_hash | Emit PRETraceEvent(PRE_FAILED) with diff; block deployment gate |

`DETERMINISM_VIOLATION` and `CORPUS_DIVERGENCE` are deployment-blocking. No workaround. Must be fixed.

---

## 7. CONSTRAINTS

- The resolution function (Steps 1–6) must be a pure function: same inputs → same outputs, always.
- No I/O inside the resolution function.
- No access to wall clock inside the resolution function.
- No access to mutable global state inside the resolution function.
- No randomness inside the resolution function.
- The rule set for a given rule_version is immutable once published.
- GovernedClock is the only permitted time source in all callers.
