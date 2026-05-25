# ClubHub TV — Recovery Policies

## CLASS_0 — No Action Required

- System is operating normally.
- No recovery steps needed.
- Monitor standard telemetry dashboards.

## CLASS_1 — Monitor

- Log ADVISORY telemetry.
- Alert on-call if latency persists > 5 minutes.
- No state change, no rollback.
- Investigate root cause during business hours.
- Do NOT skip invariant checks to recover latency.

## CLASS_2 — Alert and Continue

- Emit WARNING telemetry immediately for each affected subsystem.
- Alert operator via primary notification channel.
- PRE continues serving — do NOT fall back due to CLASS_2 alone.
- Log all audit gaps if audit writer is unavailable.
- Attempt automatic subsystem recovery (restart, reconnect) up to 3 times.
- If subsystem does not recover within 10 minutes, escalate to on-call.
- Document the gap window in incident log.

## CLASS_3 — Halt and Investigate

- Emit CONSTITUTIONAL_BREACH telemetry immediately.
- Halt canary advancement (do not advance to next stage).
- Do NOT auto-rollback — human decision required.
- Continue serving legacy path only.
- Do NOT serve PRE output after CLASS_3 is confirmed.
- Page on-call immediately.
- Investigate all affected packets (flag for manual review).
- Require human operator sign-off before resuming canary.
- Post-incident review required before PRE re-enablement.

## CLASS_4 — All-Stop Incident

- Emit CATASTROPHIC telemetry to all sinks.
- Auto-halt canary immediately (this is the only auto-executable action).
- All-stop on new merges to main branch.
- Serve legacy resolver only — no PRE output.
- Page on-call and engineering lead immediately.
- Open P0 incident ticket.
- Do not restart replay as trusted source until investigation complete.
- No auto-recovery — human intervention required at every step.
- Post-incident RCA required before system re-enablement.

## CLASS_5 — Manual Intervention Only

- Emit CATASTROPHIC telemetry to all sinks.
- System enters EMERGENCY_FREEZE mode.
- No PRE resolution permitted.
- No shadow comparison permitted.
- No canary activity permitted.
- Audit writes forbidden (reads only).
- Serve LEVEL_0 emergency content if emergency is active, else LEVEL_5 system fallback.
- Accept no new operator writes.
- Requires explicit human authorization token to exit EMERGENCY_FREEZE.
- Escalate to executive stakeholders.
- Require signed incident report before any system re-enablement.
