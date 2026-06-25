# REPLAY_FLOW.md
# Replay Execution Flow Diagram

```
Operator selects time range in ReplayTimeline
       │
       ▼
GovernedEventStream.startReplay({ from_ts, to_ts })
       │
       ▼
Fetch events from API/store
       │
       ▼
Sort events by lineage_ts ascending ◄─── HARD guarantee
       │
       ▼
runtime.enterReplay(correlationId)
  ├──► replayHooks._replayMode = true
  ├──► replayHooks._sideEffectsSuppressed = true
  └──► lifecycle ACTIVE ──► REPLAY

       │
       ▼  for each event:
┌──────────────────────────────────────┐
│  store.applyReplayEvent(event)       │
│    ├── assertReplayMode()            │
│    ├── _reduceEvent(event)           │
│    │     (no received_at update)     │
│    └── notify subscribers           │
└──────────────────────────────────────┘
       │
       ▼
All events applied ──► ReplayTimeline cursor at end
       │
       ▼  Operator exits replay:
runtime.exitReplay()
  ├──► replayHooks._replayMode = false
  ├──► lifecycle REPLAY ──► ACTIVE
  └──► SnapshotClient.fetchSnapshot()
             │
             ▼
       Live state restored ◄─── HARD guarantee
```

## What is suppressed during replay

```
SUPPRESSED:              NOT suppressed:
─────────────────        ──────────────────────
AuditLedger writes       Config reads
DB mutations             Incident queries
Token issuance           Topology queries
Token revocation         Event bus subscriptions
Wave promotions          ForensicView analysis
Freeze operations        Snapshot reads
```
