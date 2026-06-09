# Entropy Review Workflows

**Document type:** Operational workflow specification
**Audience:** VENUE_OPERATOR (advisory response), REGIONAL_MANAGER (warning response), ENTERPRISE_ADMIN (critical response), platform engineers
**Depends on:** OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, SCREEN-COMMISSIONING.md, INCIDENT-RECOVERY-WORKFLOWS.md, CLUBHUB_SYSTEM_CONTRACTS.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. What Entropy Is

Entropy in ClubHub TV is the divergence between what PRE expects to find in the content corpus on a device and what is actually present on that device. A screen with zero entropy divergence has exactly the content its CorpusVersion binding specifies, with matching checksums. A screen with high entropy divergence has missing assets, stale assets, or checksum mismatches that mean PRE cannot reliably resolve deterministic playlists.

Entropy is not an error state — it is a measurement. Every screen will have some entropy over time as content is updated, network delivery is imperfect, and hardware degrades. The platform tracks entropy continuously and provides operators with the information they need to respond proportionally.

**Why entropy matters for PRE determinism:** PRE.resolve() is a pure function with respect to its inputs. If the corpus on a device does not match the corpus version PRE expects (because an asset is missing or corrupted), PRE may resolve a playlist that references an asset the device cannot play. This causes a divergence between what PRE computed and what the screen actually displays. Entropy monitoring prevents this class of divergence by alerting operators before it becomes a playback problem.

---

## 2. Entropy Report Anatomy

Every entropy report contains:

```
venue_id:              The venue this report covers
scan_timestamp:        When the scan was performed
scan_type:             VENUE_SCAN (60-minute interval) | FLEET_SCAN (6-hour interval)
affected_screen_ids[]: Screens with non-zero divergence
corpus_version_id:     The expected corpus version checked against
missing_assets[]:      Assets expected by corpus version but absent from device
checksum_mismatches[]: Assets present on device with different checksum than expected
stale_assets[]:        Assets present but from a previous corpus version, superseded
severity:              ADVISORY | WARNING | CRITICAL
severity_rationale:    Why this severity level was assigned
resolution_options[]:  Available response actions (see §4)
sla_deadline:          When this report must be acknowledged to avoid circuit breaker escalation
```

### 2.1 Severity Assignment

| Severity | Conditions                                                                                       |
|----------|--------------------------------------------------------------------------------------------------|
| ADVISORY | Missing assets <5% of corpus; no checksum mismatches on currently-playing content; isolated to ≤2 screens |
| WARNING  | Missing assets 5-20% of corpus; or checksum mismatches on any currently-playing content; or ≥3 screens affected |
| CRITICAL | Missing assets >20% of corpus; or checksum mismatch on compliance or emergency content; or all screens in a zone affected; or entropy divergence rate increasing (not stable) |

CRITICAL severity is always assigned if the missing or mismatched asset is in the `emergency_content` corpus slot. A venue that cannot reliably display emergency content is a safety risk and is treated with the highest urgency regardless of other metrics.

---

## 3. Entropy Scan Schedule

### 3.1 Venue Scan (60-Minute Interval)

Runs automatically every 60 minutes for each venue. Samples all commissioned screens in the venue. Alert delivery:
- ADVISORY: Available in operator dashboard; no push notification
- WARNING: Push notification to VENUE_OPERATOR and REGIONAL_MANAGER
- CRITICAL: Push notification to VENUE_OPERATOR, REGIONAL_MANAGER, and ENTERPRISE_ADMIN; also triggers immediate priority escalation

### 3.2 Fleet Scan (6-Hour Interval)

Aggregates venue scan data into a fleet-level entropy picture. Runs every 6 hours. The fleet scan looks for:
- Entropy spreading across venues (same missing asset in multiple venues — suggests corpus delivery infrastructure issue)
- Entropy trending (venues getting worse over time — suggests systemic problem)
- Deployment group entropy (screens in same group with divergent entropy — suggests partial OTA delivery failure)

Fleet scan alerts go to REGIONAL_MANAGER+ only. VENUE_OPERATOR is not notified of fleet-level scans — they receive their venue-level alerts.

### 3.3 On-Demand Scan

Any operator with VENUE_OPERATOR+ authority can trigger an on-demand entropy scan for their venue. On-demand scans do not reset the scheduled scan interval. Useful after:
- Asset resync completion (verify the resync worked)
- Emergency clearance (confirm emergency content is intact)
- Screen re-commissioning (baseline the new screen's entropy)

On-demand scans generate the same report format as scheduled scans but with `scan_type: ON_DEMAND`.

---

## 4. Entropy Review Workflow

### Step 1: Report Generated

Automated scheduler generates entropy report and delivers it:
- ADVISORY: Available in operator dashboard (passive)
- WARNING: Push notification sent to VENUE_OPERATOR and REGIONAL_MANAGER
- CRITICAL: Push notification sent to VENUE_OPERATOR, REGIONAL_MANAGER, ENTERPRISE_ADMIN; SLA clock starts

### Step 2: Operator Opens Report

Operator opens the entropy report in the operator UI. The report surface shows:
- Which screens are affected (screen IDs, zone names, physical location descriptions)
- For each screen: which specific assets are missing or mismatched
- Whether currently-playing content is affected (high urgency indicator)
- Projected playback impact: "If unresolved, these 3 screens will fail to play content at 7pm when campaign X begins"

The projections are calculated by running a SCHEDULE_WALK preview against the current corpus version and flagging ticks where a missing/mismatched asset would be required. This gives operators a concrete operational impact view, not just an abstract divergence metric.

### Step 3: Operator Selects Resolution Path

Four resolution paths are available:

#### Path A: ASSET_RESYNC

**What it does:** Triggers a push of missing or mismatched assets from the corpus store to the affected devices via OTA delivery.

**When to use:** Missing assets that are available in the platform corpus. Checksum mismatches from incomplete previous sync.

**Who can trigger:** VENUE_OPERATOR+ for any severity

**Process:**
1. System identifies missing/mismatched assets
2. OTA delivery job queued for affected devices
3. Operator UI shows delivery progress (per-device, per-asset)
4. On completion: automatic on-demand entropy re-scan to confirm resolution
5. If re-scan shows clean: report closed with `RESOLVED_VIA_RESYNC`
6. If re-scan still shows divergence: report escalated to WARNING (or to CRITICAL if was already WARNING)

**Estimated duration:** Depends on asset size and network conditions. Typical: 5-30 minutes per device for a full corpus resync. Status visible in real-time.

#### Path B: CORPUS_ROLLBACK

**What it does:** Reverts the affected screens to a previous known-good CorpusVersion.

**When to use:** Current corpus version has delivery problems. Previous version was clean and is still operationally acceptable. Used when ASSET_RESYNC has failed or the issue is in the corpus itself (not the delivery).

**Who can trigger:** REGIONAL_MANAGER+ for WARNING; ENTERPRISE_ADMIN+ for CRITICAL

**Process:**
1. Operator selects which previous CorpusVersion to roll back to
2. System shows preview of what changes: content diff between current version and rollback target
3. Operator confirms rollback, provides reason (required)
4. PRE switches to the rollback CorpusVersion for affected screens at next tick
5. OTA delivery of rollback version assets (if not already on device)
6. Entropy re-scan confirms rollback target version is fully present
7. Audit record: `entropy.corpus_rollback_executed` with `from_version`, `to_version`, `screen_ids[]`, `triggered_by`, `reason`

**Important:** Corpus rollback does not cancel campaigns, overrides, or sponsorships. Those objects retain their corpus binding. If a campaign references assets in the rolled-back version, it continues to resolve against the rollback version until a ENTERPRISE_ADMIN explicitly re-assigns the campaign to a new corpus version or returns to the forward version.

#### Path C: ACKNOWLEDGE_ACCEPTABLE

**What it does:** Marks the entropy divergence as known and acceptable. Does not fix the divergence but records that an operator has reviewed it and determined it is not operationally harmful.

**When to use:** Asset that is "missing" per corpus version spec is missing intentionally (e.g., optional content that was removed locally). Divergence is stable (not growing). No impact on currently-playing or soon-to-play content.

**Who can trigger:**
- ADVISORY: VENUE_OPERATOR+
- WARNING: REGIONAL_MANAGER+
- CRITICAL: ENTERPRISE_ADMIN+ (also triggers mandatory constitutional review comment)

**Process:**
1. Operator provides acknowledgment reason (required free text)
2. Operator attests they have reviewed the projected playback impact
3. For CRITICAL: operator provides constitutional review justification (why this is acceptable despite severity)
4. Acknowledgment written to audit log: `entropy.acknowledged` with `acknowledged_by`, `severity`, `reason`, `projected_impact_reviewed: true`
5. Report marked ACKNOWLEDGED; SLA clock stopped
6. Next scheduled entropy scan will generate a new report if divergence persists (acknowledgment applies to this report, not future reports)

**What acknowledgment does NOT do:** It does not suppress future entropy alerts for the same issue. Each scan generates a fresh report. If the same divergence persists in the next scan, the operator must acknowledge again (or resolve it). This prevents "acknowledge and forget" patterns where a growing entropy problem is hidden behind stale acknowledgments.

#### Path D: ESCALATE

**What it does:** Flags the report for review by a higher-authority operator.

**When to use:** VENUE_OPERATOR does not have sufficient context to determine the appropriate resolution. Entropy severity is above VENUE_OPERATOR's acknowledgment authority.

**Who can trigger:** VENUE_OPERATOR (escalates to REGIONAL_MANAGER); REGIONAL_MANAGER (escalates to ENTERPRISE_ADMIN)

**Process:**
1. Operator flags the report as ESCALATED with a context note (optional but recommended)
2. Target operator (one level up) receives notification with escalation context
3. SLA clock continues — escalation does not reset the acknowledgment deadline
4. Escalated report appears in the higher-authority operator's queue with ESCALATED indicator

### Step 4: Post-Resolution Entropy Re-Scan

After any resolution path that claims to fix the divergence (ASSET_RESYNC, CORPUS_ROLLBACK), the system runs an automatic on-demand scan to confirm the resolution.

If the re-scan shows the divergence is resolved:
- Report status: RESOLVED
- `entropy.resolved` audit record written: `resolution_path`, `time_to_resolve_minutes`, `screens_resolved[]`

If the re-scan shows divergence persists:
- Severity may escalate (ADVISORY → WARNING, WARNING → CRITICAL) if duration threshold is met
- Operator is notified that the resolution attempt was unsuccessful
- Resolution paths remain available for another attempt

### Step 5: Acknowledgment Recorded

All entropy resolution actions — including acknowledgment of acceptable divergence — are written to the audit log. The audit record is the accountability mechanism for entropy management.

---

## 5. Entropy Acknowledgment Authority

| Severity | Can Acknowledge           | Notes                                                            |
|----------|---------------------------|------------------------------------------------------------------|
| ADVISORY | VENUE_OPERATOR+           | No escalation required                                           |
| WARNING  | REGIONAL_MANAGER+         | VENUE_OPERATOR can escalate but cannot acknowledge alone         |
| CRITICAL | ENTERPRISE_ADMIN+         | Triggers mandatory constitutional review comment                 |

CRITICAL entropy acknowledgment by ENTERPRISE_ADMIN+ includes a required field: `constitutional_review_comment`. This is a free-text field where the enterprise admin documents why the CRITICAL entropy is acceptable from a constitutional perspective. This field is immutable after submission and becomes part of the permanent audit record.

---

## 6. Entropy and Circuit Breakers

### 6.1 SLA Escalation

CRITICAL entropy reports carry an SLA deadline by which they must be acknowledged:
- Default SLA: 4 hours from report generation
- For emergency_content slot divergence: 1 hour SLA

If the SLA deadline passes without acknowledgment:
- Automatic escalation: ENTERPRISE_ADMIN receives urgent notification
- 1 additional hour: if still not acknowledged, PRECircuitBreaker escalation is triggered for the affected venue(s)
- PRECircuitBreaker threshold=3: three unacknowledged CRITICAL entropy reports within 24 hours triggers circuit breaker OPEN for the venue

### 6.2 Circuit Breaker Trip from Entropy

A PRECircuitBreaker trip from entropy puts the venue in DEGRADED constitutional state. Recovery requires:
1. Acknowledgment or resolution of all outstanding CRITICAL entropy reports
2. REGIONAL_MANAGER+ explicit circuit breaker reset
3. Entropy re-scan confirming current severity is not CRITICAL

The circuit breaker trip itself does not halt PRE — it puts the venue in DEGRADED, not EMERGENCY_FREEZE. PRE continues to resolve content, but the system is flagged and incident response protocols are active (see INCIDENT-RECOVERY-WORKFLOWS.md §P3 response).

---

## 7. Entropy and Canary Promotion

A venue with any unresolved entropy report above ADVISORY severity cannot advance its canary promotion stage. This is a hard gate — the canary promotion UI will show the entropy block and the specific unresolved report as the reason.

Resolution options:
1. Resolve the entropy report (ASSET_RESYNC or CORPUS_ROLLBACK) → re-scan confirms clean → canary advance unblocked
2. Acknowledge the report as acceptable (with appropriate authority) → canary advance unblocked

Entropy blocks apply per-venue, not per-deployment-group. If a deployment group contains 5 venues and 1 has unresolved WARNING entropy, only that venue is blocked from advancing — the other 4 can proceed through canary stages independently.

---

## 8. Entropy Audit Record Reference

| Event                         | Emitted At                    | Required Fields                                                                  |
|-------------------------------|-------------------------------|----------------------------------------------------------------------------------|
| `entropy.scan_completed`      | Each scan                     | venue_id, scan_type, scan_timestamp, affected_screen_count, severity            |
| `entropy.report_generated`    | Non-zero divergence detected  | venue_id, report_id, severity, missing_asset_count, checksum_mismatch_count     |
| `entropy.alert_sent`          | On WARNING/CRITICAL           | report_id, notified_user_ids[], alert_channel                                   |
| `entropy.resync_triggered`    | Path A selected               | report_id, affected_screen_ids[], asset_ids[], triggered_by                     |
| `entropy.resync_completed`    | OTA delivery done             | report_id, success: bool, devices_resolved[], devices_still_divergent[]         |
| `entropy.corpus_rollback_executed` | Path B executed          | report_id, from_version, to_version, screen_ids[], triggered_by, reason        |
| `entropy.acknowledged`        | Path C executed               | report_id, acknowledged_by, severity, reason, constitutional_review_comment?   |
| `entropy.escalated`           | Path D executed               | report_id, escalated_by, escalated_to_role, context_note                       |
| `entropy.resolved`            | Re-scan confirms clean        | report_id, resolution_path, time_to_resolve_minutes                            |
| `entropy.sla_breached`        | SLA deadline missed           | report_id, sla_deadline, breach_timestamp, auto_escalation_triggered           |
| `entropy.circuit_breaker_triggered` | PRECircuitBreaker trips | report_id, venue_id, unacknowledged_critical_count, circuit_breaker_state     |

All records append-only. Hash-chained via workflow_traces.
