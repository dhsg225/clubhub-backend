# DETERMINISM_GUIDE.md
# Governance Kernel — Determinism Guide

---

## Determinism definitions

| Level | Meaning |
|-------|---------|
| CONTENT_ADDRESSED | Output is a function of content only (SHA-256 hash). Same input → same ID always. |
| DETERMINISTIC_PER_DB | Deterministic within a DB sequence. Sequential IDs. Same result given same DB state. |
| NONDETERMINISTIC | Contains wall-clock, random bytes, or external inputs. Intentional — documented. |

---

## Content-addressed operations (HARD determinism)

| Operation | Algorithm | Notes |
|-----------|-----------|-------|
| Incident IDs | SHA-256 of (type + severity + timestamp + causal chain) | Same inputs → same ID |
| Config hash | SHA-256 of `stableStringify(config)` | Key-sorted JSON serialization |
| ConfigDiffEngine.hash() | SHA-256 of `_stableStringify()` | Matches kernel deterministic-id.js |
| ConfigProposalBuilder hash preview | SHA-256 of proposed config | Matches what kernel will compute |

### stableStringify specification

```javascript
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort(); // lexicographic key sort
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
```

**HARD guarantee:** Any two systems running the same `stableStringify` implementation on the same object produce identical output.

---

## Deterministic clock behavior

| Mode | Clock behavior |
|------|---------------|
| LIVE | `Date.now()` / `new Date().toISOString()` — wall-clock, nondeterministic |
| REPLAY | Governed replay clock — advances with events, deterministic within session |
| SIMULATION | Controlled clock — set by simulation harness |

**HARD guarantee:** In REPLAY mode, the governed clock never goes backward.
**HARD guarantee:** `deterministic_ts` on event bus events always uses the governed clock at emission time.

---

## Nondeterministic paths (documented, not concealed)

| Path | Why nondeterministic | Notes |
|------|---------------------|-------|
| `lineage_ts` | Wall-clock audit timestamp | Required for human-readable audit trail |
| `received_at` | Screen heartbeat wall-clock | Real-time receipt timestamp |
| `operator token iat/exp` | Wall-clock for token interop | Required by JWT-compatible tools |
| `ledger_action_ids` | Sequential DB seq | Deterministic per DB, not content-addressed |
| `event_id` on event bus | `crypto.randomBytes(6)` | Unique event identifier, not content-addressed |
| `jti` in operator tokens | `crypto.randomBytes(8)` | Unique token identifier |

These are NOT bugs. They are intentional nondeterministic surfaces that serve specific purposes.

---

## Replay determinism contract

**HARD guarantees:**
1. Events sorted by `lineage_ts` ascending before replay
2. `applyReplayEvent()` produces same state for same event sequence
3. `ForensicView.buildIncidentReport()` is a pure function of its inputs
4. `received_at` is NOT updated during replay (preserves original staleness profile)

**Known non-determinism in replay:**
- Sub-millisecond ordering when `lineage_ts` values are equal (advisory — not a HARD guarantee)
- Plugin renderers with `deterministic: false` may produce different output

---

## ID generation reference

```
Incident ID:   SHA-256(type + '|' + severity + '|' + ts + '|' + JSON.stringify(chain))
Config hash:   SHA-256(stableStringify(config)).slice(0, 16)  [truncated]
Event ID:      randomBytes(6).hex()  [nondeterministic, unique]
JTI:           randomBytes(8).hex()  [nondeterministic, unique]
```

---

## Verifying determinism in testing

```javascript
// Verify incident ID is content-addressed:
const id1 = await incidentManager.create('FAILURE', 'CRITICAL', { correlation_id: 'x' });
const id2 = await incidentManager.create('FAILURE', 'CRITICAL', { correlation_id: 'x' });
// id1.id should equal id2.id (same content → same hash)

// Verify config hash:
const hash1 = ConfigDiffEngine.hash({ a: 1, b: 2 });
const hash2 = ConfigDiffEngine.hash({ b: 2, a: 1 }); // different key order
// hash1 should equal hash2 (stableStringify sorts keys)
```
