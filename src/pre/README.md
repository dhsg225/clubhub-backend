# src/pre/ — Playback Resolution Engine

## Constitutional Role

The PRE is a **pure deterministic function**: `PRE.resolve(screen_id, at, db) → PRE_Output`.

It MUST satisfy all 10 invariants (INV-1 through INV-10) defined in:
- `docs/ENGINEERING-CONSTITUTION-v1.md`
- `docs/PRE-REFERENCE-IMPLEMENTATION-v1.md`

## Ownership

**Owner:** PRE maintainer
**Write policy:** Any PR; requires invariant gate (CI stage 03) + corpus gate (CI stage 02) to pass.

## Purity Constraints (INV-1)

The PRE MUST NOT:
- Write to any database table
- Issue any network request
- Read from environment variables or files at resolve time
- Use `Date.now()`, `Math.random()`, or any non-deterministic input
- Throw uncaught exceptions (INV-2: totality)
- Produce different output for the same inputs (INV-3: determinism)

## Directory Structure

```
pre/
├── index.ts              # PRE.resolve() — the sole export
├── types.ts              # PRE_Output, PlaylistItem, ContentMix
├── constants.ts          # Compile-time constants only (no env reads)
├── levels/               # One file per resolution level (0–6)
├── algorithms/           # FNV-1a, SWRR, canonicalize, timezone, schedule-active
└── queries/              # Read-only DB query wrappers (one per data domain)
```

## Forbidden Patterns (per FP-01 through FP-15)

- No SQL UPDATE/INSERT/DELETE/UPSERT in any file under this directory
- No `require('http')`, `require('axios')`, or any network library
- No `Date.now()` — timestamps passed in as the `at` parameter
- No `Math.random()`
- No hardcoded threshold values (must reference `constants.ts`)
- No duplicate resolution logic across levels
