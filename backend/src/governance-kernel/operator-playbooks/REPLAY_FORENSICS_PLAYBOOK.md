# REPLAY_FORENSICS_PLAYBOOK.md
# Operator Playbook — Replay Forensics

## Preconditions
- Kernel has event history (event bus buffer or DB-backed event store)
- Operator has OPERATOR role minimum
- Incident or anomaly under investigation

## Required authority
- Role: OPERATOR (read access to replay stream)

## Commands

```javascript
// 1. Enter replay mode via operator UI:
//    Select time range in ReplayTimeline
//    Click "Enter Replay"
//    UI transitions to REPLAY rendering mode

// 2. Step through events:
replayTimeline.play();              // autoplay
replayTimeline.pause();             // pause at current position
replayTimeline.stepForward();       // one event at a time
replayTimeline.seekTo(lineageTs);   // jump to specific timestamp

// 3. Inspect forensic overlay:
const report = forensicView.buildIncidentReport(incidentId, allEvents);
// report.causal_chain  — ordered chain of events leading to incident
// report.related_freezes — freeze events in same epoch
// report.operator_actions — operator commands during incident window
// report.lineage_anomalies — ORPHANED_EVENT, BROKEN_CAUSAL_CHAIN, etc.

// 4. Compare before/after states:
const diff = forensicView.buildBeforeAfterComparison(historicalTs, currentLiveState);
// diff.freeze_state_changed, diff.epoch_changed, diff.config_hash_changed

// 5. Exit replay:
replayTimeline.exitReplay(); // triggers snapshot refetch, live state restored
```

## Expected events
- No events emitted during forensic investigation (ForensicView is side-effect free)
- Replay entry/exit emits `governance.runtime.lifecycle_changed`

## Rollback procedures
- Replay is non-destructive — state is not mutated
- Live state is restored automatically after `exitReplay()` via snapshot refetch
- If UI shows stale state after exit: manually trigger "Force Snapshot Reload"

## Failure escalation
- `REPLAY_ISOLATION_VIOLATION` error: a mutation was attempted during replay
  - Check which operator action caused it; verify it was not executed
  - Exit replay mode; investigate whether the mutation completed in LIVE mode
- Lineage anomaly `ORPHANED_EVENT`: event references non-existent parent
  - Note in incident report; may indicate event bus buffer overflow (5000 event max)

## Replay implications
- `received_at` is NOT updated during replay — stale indicators do not trigger on historical events
- Events are sorted by `lineage_ts` ascending — ordering is deterministic
- ForensicView never calls kernel APIs, issues tokens, or writes to DB (certified RSC-04)

## Certification implications
- Replay sessions do not affect certification status
- Replay forensics can be used to investigate certification failures retroactively
