# REPLAY_VISUALIZATION_MODEL.md
# Operator UI — Replay Visualization Model

## Overview

Replay mode presents a deterministic, read-only reconstruction of past governance events.
The UI must surface replay as a distinct operational mode — not merely a filtered view.

## Replay mode entry

Replay is entered via `POST /api/operator/runtime/replay/enter` with a `correlation_id`.
The kernel emits `governance.runtime.lifecycle_changed` with `to_state: 'REPLAY'`.

```
Operator clicks "Enter Replay"
        │
        ▼
POST /api/operator/replay/enter  { correlation_id }
        │
        ▼
  OTARuntimeLifecycle: ACTIVE ──► REPLAY
        │
        ▼
  governance.runtime.lifecycle_changed  { to_state: 'REPLAY' }
        │
        ▼
  UI: activates ReplayModeOverlay
```

## Visual contract

When in REPLAY mode the UI MUST:

1. **Show REPLAY MODE banner** — persistent, high-contrast, top of viewport
2. **Display deterministic_ts** as primary timestamp (not wall-clock `received_at`)
3. **Disable all mutation controls** — freeze, incident create, config update, promote wave
4. **Show correlation_id** in the banner (links event sequence to a causal chain)
5. **Show event counter** — "Event 47 / 312" style progress indicator

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠  REPLAY MODE  │  correlation: abc-123  │  Event 47 / 312  │
└──────────────────────────────────────────────────────────────┘
```

## Event timeline display

During replay, the event stream is rendered as a scrollable timeline:

```
deterministic_ts  │  event_type                        │  payload summary
──────────────────┼────────────────────────────────────┼──────────────────
 1000             │  governance.freeze.frozen           │  reason: "OTA rollback"
 1042             │  governance.incident.created        │  severity: CRITICAL
 1087             │  governance.authority.epoch_changed │  epoch: 8 → 9
 1103             │  governance.config.updated          │  keys: [ring_count]
```

## Timestamp rendering rules

| Context          | Timestamp field to display   | Label           |
|------------------|------------------------------|-----------------|
| Normal mode      | `received_at`                | wall-clock      |
| Replay mode      | `deterministic_ts`           | logical clock   |
| Replay + hover   | Both fields                  | tooltip         |

**HARD rule**: Never display `received_at` as the primary timestamp during replay.
`received_at` is the wall-clock at emission and is NOT deterministic across replay runs.

## ForensicView integration

`ForensicView` is a read-only replay surface. It MUST be:

- Stateless between replay sessions
- Side-effect free (no DB writes, no audit entries)
- Marked as non-authoritative in all displayed output

```
┌─────────────────────────────────────────────┐
│  ForensicView  [READ-ONLY]                  │
│  Viewing: correlation abc-123               │
│  Replayed 312 events from lineage_ts range  │
│  [Not a live system state]                  │
└─────────────────────────────────────────────┘
```

## Replay exit

On `governance.runtime.lifecycle_changed` with `to_state: 'ACTIVE'`:

1. Remove REPLAY MODE banner
2. Re-enable all mutation controls
3. Resume live event stream from current position
4. Show "Replay completed — returned to ACTIVE" toast notification

## REPLAY_ISOLATION_VIOLATION handling

If the kernel emits an error event with code `REPLAY_ISOLATION_VIOLATION`:

1. Display a high-severity alert: "Replay isolation was violated — replay session may be corrupt"
2. Offer "Exit Replay" action
3. Log the violation to the operator audit trail

## SOFT guarantees

- Replay event order matches lineage_ts ascending (kernel contract)
- UI playback speed is not guaranteed — events arrive as fast as kernel emits

## See also

- `EVENT_STREAM_MODEL.md` — event envelope and namespaces
- `AUTHORITY_SURFACE_GUIDE.md` — which controls are gated during replay
- platform-docs: `REPLAY_GUIDE.md` — kernel-level replay contract
