# Incident Reproduction

**Enforcement location:** `test-runner/lib/incident-bundle.js`, `test-runner/runner.js`
**Contract check:** `validate-contracts.js` check 18 — `incident_bundle`

---

## What it is

Every severe threshold breach or consistency violation produces an incident reproduction bundle. The bundle contains all artifacts required to reproduce the failure offline, without access to the original environment.

---

## Trigger conditions

`runner.js` calls `createIncidentBundle()` when:
- `gatingResults.failed === true` (one or more threshold breaches)
- `consistencyViolations.length > 0`

The bundle is created in the `finally` block — after all reports are written — so it captures the complete post-run artifact set.

---

## Bundle contents

| Artifact | Description |
|---|---|
| `run_config` | suite, seed, deterministic — exact run parameters |
| `threshold_breaches` | Every breach: key, actual value, threshold, operator |
| `governed_thresholds` | Full snapshot of `thresholds.json` at time of failure |
| `metrics_summary` | Complete metrics summary from `getSummary()` |
| `event_stream_slice` | Last 500 metric events (poll.success, poll.failure) |
| `chaos_timeline` | Ordered chaos events with timestamps |
| `mutation_log` | Complete mutation envelope sequence with hash chain |
| `state_hash_trace` | Chain entries for divergence detection |
| `replay_capture` | Full `replay-capture.json` if present |
| `provenance_chain` | Causal chain from `failure-provenance.json` if present |
| `divergence_report` | `state-divergence.json` if a replay was run |
| `recovery_actions` | `recovery-governance.json` recovery records |
| `environment` | `node_version`, `platform`, `arch`, `pid` |

---

## Bundle files

```
reports/incidents/<incident_id>-manifest.json   — immutable index (chmod 444)
reports/incidents/<incident_id>-bundle.json     — full JSON bundle (always written)
reports/incidents/<incident_id>.tar.gz          — compressed archive (if tar available)
```

The `incident_id` format: `<ISO-timestamp>-<suite>-<6-hex-random>` (e.g., `2026-05-20T12-00-00-000Z-chaos-a3f1b2`).

---

## Bundle hash

The `bundle_hash` is SHA-256 of the canonical bundle content (stable-stringified, all fields except `bundle_hash` itself). It is embedded in both the `-bundle.json` and the `-manifest.json`.

Corruption detection on load:

```js
import { verifyBundle } from './lib/incident-bundle.js';
const result = verifyBundle('reports/incidents/<id>-bundle.json');
// result: { valid, expected_hash, actual_hash }
```

---

## Replay command

Every bundle contains a `replay_command` string — the exact CLI invocation to reproduce the failure:

```
node test-runner/runner.js --suite=chaos --replay=reports/replay-capture.json --seed=42
```

If no replay capture exists, the command uses `--seed` and `--deterministic`:

```
node test-runner/runner.js --suite=chaos --seed=42 --deterministic
```

---

## Manifest immutability

`-manifest.json` is written with `chmod 444` (read-only). This prevents accidental modification of the bundle index. The full JSON bundle and tar.gz are writable.

---

## Offline reproduction workflow

1. Locate the incident: `ls reports/incidents/`
2. Inspect: `cat reports/incidents/<id>-manifest.json`
3. Verify integrity: `node -e "import('./test-runner/lib/incident-bundle.js').then(m => console.log(m.verifyBundle('reports/incidents/<id>-bundle.json')))"`
4. Extract (if tar.gz): `tar -xzf reports/incidents/<id>.tar.gz -C /tmp/incident`
5. Replay: run the `replay_command` from the manifest

---

## Invariants

1. Every `gatingResults.failed` run produces a bundle — the call to `createIncidentBundle()` is in the `finally` block of `runner.js`.
2. The bundle contains the governed threshold snapshot — offline verification uses the thresholds active at the time of failure, not a later version.
3. `bundle_hash` is always present — corruption is detectable.
4. `replay_command` is always present — the bundle is self-describing.
5. The manifest is chmod 444 — it cannot be accidentally modified.
6. `validate-contracts.js` check 18 fails if any of these invariants are absent from the source.

---

## Limitations

- `tar.gz` creation uses `execSync('tar -czf ...')` — requires `tar` on the host PATH. If absent, only the JSON bundle is written (non-fatal; the JSON bundle is the canonical artifact).
- `randomBytes(3)` in `incident_id` is non-deterministic — two runs that fail at the same millisecond get different bundle names. This is intentional.
- The event stream is capped at 500 entries. For high-frequency fleets, earlier events may be omitted.
- Bundles are not automatically pruned. Reports directory will grow unbounded in CI environments that fail frequently.
- The bundle does not include raw log files (stdout/stderr). These are assumed to be captured by CI log retention.
