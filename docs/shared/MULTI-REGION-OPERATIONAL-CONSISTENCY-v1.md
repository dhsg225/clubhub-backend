# Multi-Region Operational Consistency
## Deterministic Operational Truth Across Regions and Datacenters
### Version 1 — Phase K, Multi-Region, Network, and Infrastructure Resilience Era

---

## 1. Governing Principle

Operational truth does not become relative because infrastructure is distributed.

When ClubHub TV operates across multiple regions or datacenters, operators in any region must still be able to answer the three fundamental operational questions:

> **What is happening? Why is it happening? What can I trust?**

Distribution introduces the possibility of conflicting truths: two regions that believe they each hold the authoritative version of a governance state that has diverged. The temptation in distributed systems design is to resolve conflicts silently, to merge states automatically, and to present operators with a smooth surface that conceals the underlying conflict.

This document explicitly prohibits that approach.

> **Conflicting truths must be surfaced, not hidden. Silent reconciliation destroys operational trust faster than visible conflict does.**

An operator who sees "state X is authoritative" when it is not has been deceived by the system. That deception may lead to operational decisions premised on false information. The cost of surfacing ambiguity is momentary confusion. The cost of concealing it is compounding failures built on a false foundation.

---

## 2. Regional Authority Hierarchy

### 2.1 Region Classification

Every deployment of ClubHub TV operates within a declared region classification:

**PRIMARY REGION:** The region that holds the authoritative governance kernel for a given operator organization. The PRIMARY region's state is the ground truth when reachable. There is exactly one PRIMARY region per operator organization at any given time.

**SECONDARY REGION:** A region that holds a synchronized replica of governance state from the PRIMARY region. Operates in read-amplified mode: full reads, governed writes (writes must be confirmed by PRIMARY unless PRIMARY is partitioned). A deployment may have zero or multiple SECONDARY regions.

**EDGE REGION:** A lightweight presence point that extends the system's physical reach but holds no independent governance state. EDGE regions relay operations to PRIMARY or SECONDARY. An EDGE region that cannot reach either PRIMARY or SECONDARY enters isolated venue mode (see §6).

**ISOLATED VENUE:** A venue that has lost contact with all regions. Operates under local authority with declared constraints (see DEGRADED-NETWORK-AND-DISCONNECTED-OPERATIONS-v1.md).

### 2.2 Authority Hierarchy

```
PRIMARY REGION
  └─ SECONDARY REGION(s)    [replicated governance state, write-confirmed by PRIMARY]
       └─ EDGE REGION(s)    [no independent state, relay to SECONDARY or PRIMARY]
            └─ ISOLATED VENUE [local authority under declared constraints]
```

Authority flows downward during normal operation and must be explicitly delegated during partition (see §8).

### 2.3 Authority Transition Requirements

A region may not assume PRIMARY authority spontaneously. PRIMARY authority is:
- Assigned at deployment configuration time
- Transferred via explicit failover procedure (see §8)
- Not acquirable via timeout-based self-promotion

The prohibition on self-promotion is constitutional. It is the primary guard against split-brain operation. A SECONDARY region that promotes itself to PRIMARY without explicit failover creates two regions each believing they hold primary authority — a condition that must never be silently resolved.

---

## 3. Cross-Region Replay Consistency

### 3.1 The Replay Consistency Requirement

The replay corpus must be consistent across all regions. An event that is in the corpus in the PRIMARY region must eventually be in the corpus of all SECONDARY regions. An event that is NOT in the PRIMARY corpus must not appear in any SECONDARY corpus.

This is not eventual consistency in the distributed systems sense. It is a sequenced replication model with declared consistency windows and explicit surfacing of lag.

### 3.2 Replication Model

**Corpus replication is sequential and ordered.** Packets are replicated to SECONDARY regions in the same order they are committed to the PRIMARY corpus. SECONDARY regions never receive packets out of order.

**Replication lag is visible.** Every SECONDARY region's operational surfaces include a replication lag indicator showing how far behind the SECONDARY corpus is from the PRIMARY corpus. This lag is expressed in:
- Wall clock lag (e.g., "12 seconds behind")
- Packet count lag (e.g., "47 packets behind")
- The timestamp of the last successfully replicated packet

**Operators always know which corpus they are reading from.** The region designation is displayed on all operational surfaces. There is no "transparent" routing that silently reads from a different region.

### 3.3 Cross-Region Replay Operations

When an operator or system invokes a replay operation:
- The region being replayed from is declared explicitly
- If replaying from a SECONDARY region, the replication lag at the time of the operation is included in the replay artifacts
- Forensic analysis that uses SECONDARY corpus data must declare the lag and note any events that may exist in PRIMARY but not yet in SECONDARY at the time of analysis

### 3.4 Corpus Consistency Verification

PRIMARY and SECONDARY regions periodically verify corpus consistency:
- Hash comparison of the most recent N packets across regions
- Discrepancy triggers a consistency alert, not a silent repair
- Human-visible consistency state (see §13) reflects verified consistency status

---

## 4. Region Isolation Behavior

### 4.1 Isolation Declaration

A region enters ISOLATION state when it cannot reach the PRIMARY region and cannot confirm that the PRIMARY region is operational. Isolation is not assumed — it is declared after a defined connectivity probe failure window.

Isolation declaration triggers:
- Visibility change: all operational surfaces display REGION_ISOLATED banner
- Authority change: the region enters its declared isolation authority profile
- Corpus behavior change: new corpus commits are held in local buffer pending reconnection
- Operator notification: all active operators receive isolation alert with current state summary

### 4.2 Isolation Authority Profile

Every region has a declared isolation authority profile that specifies what operations may proceed during isolation:

**PERMITTED_UNDER_ISOLATION:**
- All read operations against the local corpus (with replication lag declared)
- Venue-local schedule execution (from local corpus, up to the declared forward schedule horizon)
- Emergency interrupt handling (local authority)
- Operator escalation to the highest available local tier
- Alert acknowledgment and documentation

**RESTRICTED_UNDER_ISOLATION (require Tier 3 local authority with explicit acknowledgment):**
- Configuration changes to venue devices
- Schedule modifications beyond the next N hours (where N is configured per region)
- New content approvals
- Cross-venue actions within the isolated region

**PROHIBITED_UNDER_ISOLATION:**
- Actions that would normally require cross-region coordination (new operator organization onboarding, permanent configuration changes)
- Any action that presumes knowledge of the PRIMARY region's current state
- Replay corpus modifications

### 4.3 Isolation Duration Governance

Isolation is designed to be temporary. Extended isolation degrades the region's ability to make correct governance decisions because its corpus diverges from PRIMARY.

After 4 hours of isolation, a mandatory operator review is triggered: the local Tier 3 operator must explicitly acknowledge the isolation state, review the pending corpus buffer, and confirm that local operations should continue.

After 24 hours of isolation, the region enters EXTENDED_ISOLATION state with additional operational restrictions and mandatory hourly status confirmation.

---

## 5. Partial-Partition Governance

### 5.1 What is a Partial Partition

A partial partition is a condition where some network paths between regions are functional and others are not. Some operations can cross regions; others cannot. This is more dangerous than full isolation because it creates the appearance of connectivity without the reality of consistent communication.

### 5.2 Detecting Partial Partition

Partial partition detection requires probing multiple independent paths between regions:
- Data replication channel
- Control plane heartbeat channel
- Out-of-band monitoring channel (if available)

A region is in PARTIAL_PARTITION if:
- At least one channel is functional
- At least one channel is non-functional
- The operational implication depends on which channels are functional

### 5.3 Partial-Partition Operational Contracts

| Functional Channel | Non-Functional Channel | Operational Mode |
|---|---|---|
| Data replication | Control plane | DEGRADED_REPLICATION: reads and data ops proceed; governance decisions require manual cross-region confirmation |
| Control plane | Data replication | DEGRADED_DATA: governance decisions can proceed; data ops hold pending replication restoration |
| Out-of-band only | Both primary channels | PARTIAL_ISOLATION: operate as if isolated with awareness that partial communication may resume |
| All degraded | None | FULL_ISOLATION: standard isolation protocol |

Partial partition mode is always surfaced visibly. It is never treated as fully operational.

### 5.4 Partial-Partition Authority Decisions

Any governance decision made during a partial partition that could conflict with a decision being made simultaneously in the PRIMARY region requires explicit acknowledgment from the operator that they understand the decision may need to be reconciled.

The acknowledgment is recorded in the corpus buffer with a PARTIAL_PARTITION flag. On reconnection, all flagged decisions are surfaced for human review before they propagate.

---

## 6. Split-Brain Operational Handling

### 6.1 What is Split-Brain

Split-brain occurs when two regions each believe they hold PRIMARY authority and each make governance decisions independently during the partition. When connectivity is restored, they hold divergent governance states.

Split-brain is the most serious multi-region failure condition. It cannot be resolved automatically. It requires human review of every decision made during the divergence window.

### 6.2 Split-Brain Prevention

**The constitutional guard against split-brain is the prohibition on self-promotion.** No region may declare itself PRIMARY. PRIMARY status is explicitly assigned and explicitly transferred.

This means that during a partition, if the SECONDARY region cannot reach PRIMARY, it operates under its isolation authority profile — it does not assume PRIMARY status. The SECONDARY region accepts degraded operational capability in exchange for the guarantee that it will not create a split-brain condition.

This is a deliberate trade-off: some operations are unavailable during partition. This is correct. It is better to be partially unavailable than to be simultaneously authoritative in two locations.

### 6.3 Split-Brain Detection

Despite prevention measures, split-brain can occur due to:
- Incorrect failover procedure execution
- Configuration error that assigns PRIMARY to multiple regions
- Manual intervention that bypasses the failover protocol

Split-brain detection:
- Each region's corpus contains a region authority record that includes the authoritative PRIMARY designation
- On reconnection, the authority records are compared
- Divergent authority records trigger SPLIT_BRAIN_ALERT — the highest-severity operational alert

### 6.4 Split-Brain Resolution

Split-brain resolution is a human-governed process. It cannot be automated.

**Resolution steps:**
1. Both regions immediately halt all new governance decisions (enter SPLIT_BRAIN_HOLD state)
2. Governance authorities in both regions are notified
3. Both regions' divergence logs are compiled (all decisions made since the divergence began)
4. A designated primary governance authority (human) reviews the divergence logs
5. The authority determines which decisions are valid, which are superseded, and which create conflicts
6. A resolution manifest is created listing each conflicting decision and its resolution
7. One region is designated as authoritative for the post-split state
8. The other region's corpus is annotated with the SPLIT_BRAIN_RESOLUTION record
9. Divergence decisions that were superseded are marked SUPERSEDED in the corpus (not deleted)
10. Operations resume only after the resolution manifest is signed by the governance authority

### 6.5 Split-Brain Resolution Governance

**The superseded decisions are preserved in the corpus.** They are not deleted. They are annotated as SUPERSEDED with a reference to the resolution manifest. The corpus maintains a complete record of what both regions decided during the divergence, which is essential for understanding subsequent behavior.

---

## 7. Cross-Region Incident Coordination

### 7.1 Multi-Region Incident Ownership

When an incident spans multiple regions, a single incident owner must be declared. Incidents without a declared owner will be handled inconsistently across regions.

Incident owner assignment:
- If the incident originates in the PRIMARY region: PRIMARY region owns the incident
- If the incident originates in a SECONDARY region: SECONDARY region opens the incident and requests PRIMARY confirmation of ownership within 15 minutes
- If the PRIMARY region is partitioned: the highest-available region assumes incident ownership and declares this in the incident record

### 7.2 Cross-Region Incident Communication

During a cross-region incident, all regions involved maintain synchronized incident records. The incident record is the source of truth for:
- Current incident state
- Actions taken and by which region
- Decisions pending cross-region confirmation
- Estimated resolution timeline

Incident record synchronization uses the control plane channel. If the control plane channel is degraded, incident records are synchronized out-of-band via declared fallback (see DEGRADED-NETWORK-AND-DISCONNECTED-OPERATIONS-v1.md §15).

### 7.3 Cross-Region Authority During Incidents

During a declared critical incident, the incident owner region may temporarily request authority grants from SECONDARY regions:
- The secondary region explicitly grants authority to the incident owner for declared action types
- The grant is time-limited and explicitly logged
- Granted authority returns to the secondary region upon grant expiry or explicit revocation

Authority grants are never implied by connectivity states. A region that cannot receive an explicit grant does not have that authority.

---

## 8. Deterministic Failover Principles

### 8.1 What Failover Is Not

Failover is not an automated process that the system executes silently when it detects a region failure. Silent automated failover, while operationally attractive, creates:
- Uncertainty about who holds PRIMARY at any given moment
- Risk of failed failover attempts leaving authority in an undefined state
- No human in the loop to assess whether failover is appropriate

### 8.2 Failover as a Governed Procedure

Failover is a declared operational procedure executed by a human Tier 3 operator with the explicit steps:

1. **Failure assessment:** Confirm that the PRIMARY region is non-operational (not merely delayed). Use multiple probes. Wait for the declared probe failure window (default: 5 minutes).

2. **Failover authorization:** A Tier 3 operator in the candidate SECONDARY region declares intent to failover and records this in the local corpus with the evidence basis.

3. **Failover announcement:** The intent to failover is broadcast via all available channels to all other regions and to all active operators.

4. **Waiting period:** A short waiting period (default: 2 minutes) allows other regions to respond if they have information that contradicts the failure assessment.

5. **Failover execution:** If no contradicting information is received, the SECONDARY region assumes PRIMARY status. The assumption is recorded in the corpus with the timestamp and authorizing operator.

6. **State declaration:** All operational surfaces in all reachable regions are updated to reflect the new PRIMARY region.

7. **Corpus buffer activation:** New corpus commits are directed to the new PRIMARY.

### 8.3 Failover Replay Continuity

During failover, the corpus replication lag between the old PRIMARY and the new PRIMARY (SECONDARY) represents events that may exist in the old PRIMARY but not yet in the new PRIMARY.

This gap is declared explicitly:
- The failover record includes the last confirmed replication timestamp
- All corpus queries after failover that touch the potential gap window are flagged as POTENTIALLY_INCOMPLETE
- When the old PRIMARY recovers, the gap is identified and the missed events are reviewed for integration or annotation

The gap is never silently filled. It is surfaced, documented, and resolved through human-reviewed reconciliation.

### 8.4 Failback

Return of authority to the original PRIMARY region (failback) follows the same procedure as failover. There is no automatic failback. Failback requires:
- The original PRIMARY region confirms its corpus integrity
- The gap from the failover window is reconciled
- A Tier 3 operator executes the failback procedure
- All regions acknowledge the failback

---

## 9. Operational Truth Precedence Model

When multiple sources of operational truth exist (which happens during partition, replication lag, and failover transitions), the following precedence model determines which source operators should act on:

### 9.1 Precedence Tiers

**TIER 1 — PRIMARY corpus, directly observed:**
A fact that is in the PRIMARY region's corpus, confirmed by a direct query to the PRIMARY region. Highest confidence.

**TIER 2 — PRIMARY corpus, replicated to SECONDARY:**
A fact that is in the SECONDARY region's corpus with verified replication. The secondary corpus is confirmed to be consistent with PRIMARY up to the replication timestamp. Confidence: high, with declared lag.

**TIER 3 — Local buffer, unconfirmed:**
A fact that has been committed to a local corpus buffer but not yet confirmed by the PRIMARY region. This fact may or may not be accepted by the authoritative corpus. Confidence: conditional.

**TIER 4 — Human report, unverified:**
A fact that has been reported by an operator but not yet reflected in any corpus layer. This is operational signal, not operational truth. Confidence: informative only.

### 9.2 Precedence in Operational Decisions

Operational decisions that affect governance state must be based on TIER 1 or TIER 2 truth. If only TIER 3 or TIER 4 truth is available, the operator must explicitly acknowledge that they are acting on unconfirmed information before the decision is recorded.

Acknowledged decisions are flagged UNCONFIRMED_TRUTH_BASIS in the corpus buffer. They are reviewed as part of reconciliation.

### 9.3 Truth Visibility on Operational Surfaces

Operational surfaces always display the source tier of the data they are showing:
- "Confirmed (Primary)" — TIER 1
- "Replicated (XX seconds lag)" — TIER 2 with lag declaration
- "Local buffer (unconfirmed)" — TIER 3
- "Operator-reported" — TIER 4

There is no unmarked data on any operational surface. Operators always know the epistemic status of what they are seeing.

---

## 10. Region Recovery Sequencing

### 10.1 Recovery Ordering Principles

When a failed region recovers, the sequence of restoration matters. Restoring operations before restoring corpus consistency creates a window where operators make decisions based on an outdated state.

**Recovery sequence:**

**Step 1 — Region health verification:** Confirm the recovering region is operationally healthy before resuming synchronization. A region that is recovering but unstable should not receive corpus synchronization until it is confirmed stable.

**Step 2 — Corpus gap identification:** Identify the exact point of corpus divergence. Confirm the gap window: the period between the last successful replication and the region failure.

**Step 3 — Gap content review:** The events in the gap window are reviewed by a governance authority. They are classified as:
- APPLICABLE: events that should be incorporated into the recovering region's corpus
- SUPERSEDED: events that were superseded by actions taken during the region's absence
- CONFLICT: events that conflict with decisions made during the region's absence and require explicit resolution

**Step 4 — Corpus reconciliation:** APPLICABLE events are replicated to the recovering region. SUPERSEDED events are annotated in the recovering region's corpus. CONFLICT events enter the split-brain resolution process (§6.4).

**Step 5 — Operational surface restoration:** Once corpus consistency is confirmed, operational surfaces are restored.

**Step 6 — Operator briefing:** Active operators in the recovering region receive a state summary covering: what happened during the outage, what decisions were made in their absence, and any operational implications for current operations.

### 10.2 Partial Recovery

A region may recover from some failures but not others (e.g., corpus replication restored but control plane still degraded). Partial recovery is acknowledged explicitly — the region's state is PARTIAL_RECOVERY with a declaration of which capabilities are restored and which remain degraded.

Partial recovery does not trigger full operational resumption. Operators in partially-recovered regions see a clear declaration of which operations are available and which remain restricted.

---

## 11. Replay Continuity During Migration and Failover

### 11.1 The Continuity Requirement

Replay must never be unavailable during a migration or failover. The corpus is the operational record. Losing access to the corpus during the exact period when unusual events are occurring would be catastrophic for incident analysis.

### 11.2 Read-Only Replay During Failover

During failover, the SECONDARY region's corpus may be read but not written. This means:
- Forensic analysis can continue during failover
- New events are buffered, not lost
- Operators can investigate prior events while the failover proceeds

### 11.3 Replay Buffer Protocol

Events that occur during the failover window are written to a local replay buffer:
- The buffer is an append-only structure
- Events are written to the buffer in the order they are committed locally
- The buffer is sealed when the new PRIMARY is confirmed
- The buffer is reviewed and incorporated into the corpus in the reconciliation step

Buffer events are marked FAILOVER_BUFFER in the corpus to indicate they were captured during the transition window. This marking is permanent — it is part of the operational record.

---

## 12. Region Trust-State Visibility

### 12.1 The Trust State Model

Every region has an observable trust state that operators can inspect at any time:

```
NOMINAL          — All channels functional, replication current, no anomalies
REPLICATION_LAG  — Data channels functional, replication behind by declared amount
PARTIAL_PARTITION — One or more channels degraded, operations restricted
ISOLATION        — No connectivity to PRIMARY, operating under isolation profile
EXTENDED_ISOLATION — Isolation exceeding 24 hours, additional restrictions active
PARTIAL_RECOVERY — Connectivity partially restored, some capabilities still restricted
SPLIT_BRAIN_HOLD — Split-brain detected, all governance decisions halted
RECONCILING      — Post-split or post-recovery reconciliation in progress
FAILOVER_ACTIVE  — Region is assuming or transferring PRIMARY authority
```

### 12.2 Trust State Display

Trust state is displayed on:
- All operational console headers (not dismissible, not minimizable)
- All API responses (in a status envelope field)
- All corpus query results (in the result metadata)

Trust state transitions generate a notification to all active operators in the affected region. The notification includes:
- The new state
- The time of transition
- The cause (where determinable)
- Which operations are now restricted

### 12.3 Trust State in Replays

When reviewing corpus events that occurred during a non-NOMINAL region state, the trust state at the time is included in the event metadata. This allows forensic analysis to correctly interpret events in context — an operator decision made during ISOLATION was made under different information availability than the same decision made under NOMINAL.

---

## 13. Time Authority Governance

### 13.1 Time as a Source of Conflict

In distributed systems, time is not a given — it is a service. Different regions may have clock skew. If that skew is unmanaged, events may be recorded in the wrong order, causal chains may be incorrect, and operations may behave unexpectedly at time boundaries.

### 13.2 Time Authority Model

One region serves as the time authority for each operator organization. This is the PRIMARY region, which maintains the authoritative time source.

All regions synchronize their clocks against the time authority:
- Synchronization frequency: every 30 seconds
- Maximum permitted skew: 500 milliseconds
- Skew exceeding maximum triggers CLOCK_SKEW_ALERT

### 13.3 Clock Skew During Partition

When a region is isolated from the time authority, it maintains its last synchronized clock and tracks clock drift:
- Drift is accumulated and declared in all event timestamps during isolation
- Events during isolation are timestamped with both the local time and the drift estimate
- On reconnection, clock resynchronization occurs before any corpus reconciliation

### 13.4 Time-Sensitive Operations During Partition

Operations that are time-sensitive (schedule execution, time-bounded approvals) during a partition use the locally-held clock with declared uncertainty:
- "Schedule execution at 14:00 (local clock, ±300ms estimated drift)"
- Operators are informed of clock uncertainty when making time-sensitive decisions
- Time-sensitive corpus events during partition are marked TIME_UNCERTAIN with the drift estimate

---

## 14. Cross-Region Drift Detection

### 14.1 What is Cross-Region Drift

Cross-region drift occurs when regions diverge in their operational behavior despite maintaining nominal connectivity. This is not corpus divergence — the corpus is consistent — but behavioral divergence. Two regions apply the same corpus events but produce different operational outcomes.

Sources of cross-region drift:
- Different software versions deployed to different regions
- Different configuration parameters
- Different dependency versions
- Clock skew producing different time-boundary decisions

### 14.2 Drift Detection Protocol

Drift detection runs daily across all region pairs:
1. Select 20 recent corpus events from the PRIMARY corpus
2. Re-execute each event against each region's current software stack
3. Compare outputs
4. Flag any output differences as drift candidates
5. Classify candidates as INTENTIONAL (declared version difference) or UNINTENDED

UNINTENDED drift generates a REGION_DRIFT_ALERT and triggers an investigation.

### 14.3 Drift Visibility

Cross-region drift is displayed in the region trust state (as a modifier to NOMINAL or other states). Operators see:
- "NOMINAL (1 drift candidate)" — nominal connectivity with a pending drift investigation

Drift is not silent. It is surfaced as part of the trust state until it is classified and resolved.

---

## 15. Human-Visible Consistency State Indicators

Every operational console in every region displays the following at all times:

**Region designation:** Which region this console is connected to.
**Authority state:** Whether this region is PRIMARY, SECONDARY, or EDGE; whether that state is confirmed.
**Trust state:** The current trust state (see §12.1).
**Replication lag:** For SECONDARY regions, the current lag behind PRIMARY.
**Last verified consistency:** Timestamp of the last successful corpus consistency verification.
**Active restrictions:** Summary of any operations restricted due to non-NOMINAL state.

These indicators are:
- Persistent (not dismissible)
- Prominently placed (top of all operational surfaces)
- Updated in real time
- Included in all session recordings and certification artifacts

---

## 16. Named Regional Failure Classes

| Class | Name | Description |
|---|---|---|
| RFC-001 | PRIMARY_UNREACHABLE | PRIMARY region non-operational or all connectivity paths failed |
| RFC-002 | REPLICATION_STALL | Corpus replication has stopped; regions are diverging in content |
| RFC-003 | CONTROL_PLANE_PARTITION | Control plane channel down; data replication may continue but governance decisions cannot cross regions |
| RFC-004 | CLOCK_SKEW_VIOLATION | Clock skew between regions exceeds maximum permitted threshold |
| RFC-005 | SELF_PROMOTION_DETECTED | A region has declared itself PRIMARY without executing the failover procedure |
| RFC-006 | SPLIT_BRAIN | Two regions simultaneously hold PRIMARY designation |
| RFC-007 | FAILOVER_STALL | A failover procedure was initiated but not completed; PRIMARY authority is undefined |
| RFC-008 | RECONCILIATION_CONFLICT | Post-recovery reconciliation has identified conflicting decisions that cannot be automatically resolved |
| RFC-009 | CORPUS_DIVERGENCE | The corpus in two regions contains conflicting versions of the same event |
| RFC-010 | GHOST_REGION | A region that was declared decommissioned continues to accept and commit events |
| RFC-011 | CASCADE_ISOLATION | Multiple SECONDARY regions isolated simultaneously; PRIMARY is the only operational region |
| RFC-012 | RECOVERY_LOOP | A region repeatedly enters and exits recovery state without stabilizing |

---

## 17. Replay Divergence Handling

When replay execution produces different results across regions, the divergence handling protocol applies:

1. Both divergent outputs are preserved — neither is discarded.
2. The PRIMARY corpus version is authoritative for determining which output is correct.
3. The SECONDARY output is annotated with REPLAY_DIVERGENCE and the PRIMARY result.
4. A REPLAY_DIVERGENCE_ALERT is generated.
5. The divergence is investigated for root cause (see REPLAY-INTELLIGENCE-AND-FORENSICS-v1.md §9).
6. If the divergence is due to software difference, it is classified as INTENTIONAL_DIVERGENCE pending version synchronization.
7. If the divergence is unexplained, it is escalated as a determinism violation.

---

## 18. Constitutional Restrictions on Reconciliation

The following reconciliation behaviors are unconditionally prohibited:

1. **Automatic merge of conflicting governance decisions.** When two regions have made conflicting decisions, the conflict is declared to operators. A human authority resolves it. Algorithms may present options; they may not choose.

2. **Silent discard of any corpus event.** If a corpus event must be superseded due to a reconciliation decision, it is annotated SUPERSEDED and preserved. It is not deleted.

3. **Timestamp backdating to resolve ordering conflicts.** Events are timestamped when they occur. Retroactive timestamp adjustment to impose a false ordering is prohibited.

4. **Convergence assumptions.** No operational surface may present an eventually-consistent state as currently-consistent. If a state is "converging," it is labeled as converging with a progress indicator, not presented as already converged.

5. **Authority inheritance without explicit grant.** No region may inherit authority from another region based on inference. Authority is explicitly granted, explicitly transferred, and explicitly recorded.

6. **Post-factum reconciliation that produces a single clean history.** The operational record retains all branches, all decisions, and all corrections. There is no cleaned-up version of history. The divergence is part of the record.
