# Deterministic Replay Example

Verifies that replay produces identical output across multiple runs for the same event sequence.

## Overview

This example demonstrates:
- Loading a fixed sequence of events sorted by `lineage_ts`
- Replaying the sequence multiple times
- Verifying that output (content-addressed hashes) is identical across all runs
- Confirming `received_at` is NOT used in deterministic output

## Prerequisites

- No PostgreSQL required — this example uses in-memory state only

## Running

```bash
node index.js
```

## What to expect

```
[replay] Run 1 — processing 5 events
[replay] Run 1 — content hash: a3f7c2d1e9b8...
[replay] Run 2 — processing 5 events
[replay] Run 2 — content hash: a3f7c2d1e9b8...
[replay] Run 3 — processing 5 events
[replay] Run 3 — content hash: a3f7c2d1e9b8...
[verify] All 3 runs produced identical content hash ✓
[verify] received_at excluded from hash: confirmed ✓
[done] Deterministic replay example complete
```

## Determinism contract

| Deterministic                | Non-deterministic (excluded from hash) |
|------------------------------|----------------------------------------|
| `lineage_ts` (logical clock) | `received_at` (wall-clock)             |
| `event_type`                 | Node ID                                |
| `event_id`                   | Network latency                        |
| `payload` (stable-stringified) | DB query duration                    |

## CONTENT_ADDRESSED operations

The governance kernel uses content-addressed hashing via `stableStringify` for:
- Deterministic serialization (lexicographic key sort)
- Replay verification (same events → same hash)
- Event lineage integrity (hash chain)

## See also

- [DETERMINISM_GUIDE.md](../../platform-docs/DETERMINISM_GUIDE.md)
- [REPLAY_GUIDE.md](../../platform-docs/REPLAY_GUIDE.md)
