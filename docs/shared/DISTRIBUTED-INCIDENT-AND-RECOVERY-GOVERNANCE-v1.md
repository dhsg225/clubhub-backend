# Distributed Incident and Recovery Governance
## Governing Incident Coordination Across Regions, Venues, and Degraded Infrastructure
### Version 1 — Phase K, Multi-Region, Network, and Infrastructure Resilience Era

---

## 1. Governing Principle

Incidents in distributed systems do not respect regional boundaries, connectivity maps, or staffing schedules. An infrastructure failure at 3am may span four venues in two regions with one on-call operator and a partially partitioned control plane.

The governing principle for distributed incident management is:

> **Calm under failure. Recovery is earned through verification, not declared through impatience.**

Effective recovery requires knowing where authority lies, what information can be trusted, and what sequence of actions is safe. It requires operators to resist the pressure to declare resolution before it has been verified. And it requires the system to surface ground truth rather than optimistic projections.

This document governs how incidents are coordinated, escalated, recovered, and verified when they span regions, venues, and degraded infrastructure. It is designed to produce trustworthy recovery — not fast-looking recovery that creates the next incident.

---

## 2. Distributed Incident Authority Hierarchy

### 2.1 Incident Authority at Different Scopes

**Venue-Local Incident Authority:**
Held by the highest-tier certified operator present at or connected to the venue. Governs incidents whose scope is contained within a single venue. Authority is limited to locally-authorized actions (see DEGRADED-NETWORK-AND-DISCONNECTED-OPERATIONS-v1.md §15).

**Multi-Venue Incident Authority:**
Held by the regional Tier 3 operator responsible for the affected venues. Governs incidents that span multiple venues in the same region. Can coordinate actions across venues, override local authority for the incident scope.

**Regional Incident Authority:**
Held by the PRIMARY region's Tier 3 operator. Governs incidents that affect a full region or require cross-region coordination. Can request authority grants from secondary regions, direct failover procedures.

**Cross-Regional Incident Authority:**
Held by the Platform Tier 3 authority (the organization's highest operational authority). Governs incidents that span regions, require multi-region failover, or involve fundamental infrastructure failure. May coordinate between operator organizations in fleet-scale events.

### 2.2 Authority Declaration

When an incident is opened, the incident authority at the appropriate scope is declared immediately:
- Incident record includes the authority holder's identity and tier
- All parties involved in the incident response are notified of who holds authority
- Authority challenges are resolved by escalation, not by concurrent action

An incident without a declared authority holder is an unowned incident. Unowned incidents are escalated to the regional Tier 3 automatically after 10 minutes without owner declaration.

### 2.3 Authority Transfer Protocol

Authority transfers during an incident (e.g., shift handoff, escalation to higher tier) follow the explicit handoff protocol:
1. The incoming authority holder receives a complete state briefing from the outgoing holder
2. The incoming holder explicitly acknowledges understanding of the current state
3. The authority transfer is recorded in the incident corpus record with timestamp
4. The outgoing holder confirms transfer and moves to observer status

There is no implicit authority transfer. If an operator stops responding without completing a transfer, the incident is considered authority-orphaned and escalation is triggered.

---

## 3. Regional Command Transfer

### 3.1 When Regional Command Transfer Occurs

Regional command transfer (RCT) is the transfer of incident authority from one region's operational team to another. RCT occurs when:

- The PRIMARY region's operational team is unavailable (out of hours, overwhelmed)
- The incident originated in a SECONDARY region that has direct knowledge
- The PRIMARY region has entered ISOLATION state
- The incident scope is primarily within a SECONDARY region

### 3.2 RCT Protocol

**Initiation:**
The requesting region declares RCT intent to the current authority holder with the stated basis.

**Acknowledgment:**
The current authority holder acknowledges the request within 10 minutes. Silence after 10 minutes does not constitute transfer — it triggers authority-orphan escalation.

**State transfer:**
The current authority holder produces a state summary covering:
- Active incident status
- Actions taken and pending
- Information gaps and uncertainties
- Known risks in the current situation

**Acceptance:**
The new authority holder reviews the state summary, asks clarifying questions, and explicitly accepts authority.

**Confirmation:**
Both parties record the transfer in the incident corpus with the state summary attached.

### 3.3 RCT During Communication Degradation

If RCT must occur while the control plane channel between regions is degraded:
- The state summary is transmitted via the available fallback communication channel
- The transfer is acknowledged via the same channel
- Both sides record the transfer independently in their local corpus buffers
- On connectivity restoration, both records are reconciled

If communication is too degraded for a proper transfer, the receiving region assumes incident authority explicitly as ASSUMED_AUTHORITY (not TRANSFERRED_AUTHORITY) and documents the basis. Assumed authority carries the obligation to confirm with the original holder at the earliest opportunity.

---

## 4. Multi-Region Escalation Coordination

### 4.1 Escalation Triggers

A regional incident escalates to multi-region escalation when:
- The incident's root cause is in shared infrastructure (affecting multiple regions)
- The incident's impact crosses regional boundaries
- The incident has lasted beyond the regional team's declared resolution window
- The PRIMARY region is unable to coordinate response due to its own degradation

### 4.2 Multi-Region Incident Coordination Protocol

When a multi-region incident is declared:
1. A primary incident commander is designated (typically the Platform Tier 3 authority)
2. Each region assigns a regional liaison to the multi-region coordination channel
3. A shared incident record is established — one record, contributed to by all regions
4. Each region's actions are coordinated through the incident commander

The incident commander makes coordination decisions. Regional teams execute within their regions. Regional teams do not take cross-regional actions without incident commander authorization.

### 4.3 Information Sharing During Multi-Region Incidents

Each region's liaison contributes to the shared incident record at defined intervals:
- Every 15 minutes: current regional status update
- Immediately: any significant change in regional status
- Immediately: any action that affects other regions or shared infrastructure

Information shared in the multi-region incident record is sourced from each region's local corpus. The trust level of each contribution is declared (TIER 1, TIER 2, TIER 3, TIER 4 — per REPLAY-INTELLIGENCE-AND-FORENSICS-v1.md §2).

---

## 5. Partition-Aware Incident Handling

### 5.1 How Partitions Complicate Incidents

A network partition during an incident creates three problems:
1. Information about the incident cannot flow freely between regions or venues
2. Actions taken on one side of the partition may conflict with actions on the other side
3. When the partition resolves, both sides must reconcile what they did during the partition

### 5.2 Partition Detection During Incident Response

When a partition is detected during an active incident:
- The incident record is immediately annotated: PARTITION_DETECTED at [timestamp] between [region A] and [region B]
- Each region's incident response continues under its local authority
- Each region's incident actions are buffered for reconciliation
- Each region declares its incident status independently

The partition does not cause the incident to be abandoned. It causes each region to operate as if it holds local authority for its scope.

### 5.3 Independent Incident Records

During a partition, each region maintains its own incident record. When the partition resolves:
- Both records are merged chronologically
- Conflicting decisions are flagged (two regions took conflicting actions for the same operational scope)
- The merged record is reviewed by the incident commander before the incident is closed
- Conflicting decisions are resolved per the precedence model in MULTI-REGION-OPERATIONAL-CONSISTENCY-v1.md §9

### 5.4 Partition-Safe Action Selection

When an operator must take action during a partition and is uncertain whether the same action might be taken on the other side:

**Prefer idempotent actions.** An action that can be safely applied twice (like declaring a fallback state) is safer than an action that can only be correctly applied once.

**Prefer reversible actions.** An action that can be undone (like pausing a schedule) is safer than an action that cannot (like clearing a corpus buffer).

**Prefer restrictive actions.** An action that prevents further damage (like restricting operations to safe defaults) is safer than an action that expands operational scope.

**Prefer local scope actions.** Actions that affect only the local venue are less likely to conflict with actions on the other side of the partition.

---

## 6. Recovery Sequencing Across Regions

### 6.1 Recovery Sequence Principles

Recovery must proceed in an order that does not compound the incident. The wrong recovery sequence can create a second incident worse than the first.

**Principle 1 — Stabilize before restoring.** Ensure the failure is contained and not spreading before attempting to restore capability.

**Principle 2 — Restore sequentially.** Restore components in dependency order. Restoring a dependent component before its dependency is stable creates a new failure.

**Principle 3 — Verify each step.** Confirm that each restoration step has succeeded before proceeding. An unverified restoration step that fails silently produces a "recovered but untrusted" state (see §10).

**Principle 4 — Restore smallest scope first.** Restore individual venues before venue clusters, venue clusters before regions, regions before cross-region.

**Principle 5 — Brief operators at each step.** Operators in each scope are briefed before that scope is restored. They know what just happened, what was done, and what to watch for.

### 6.2 Regional Recovery Sequence

For a full regional failure recovery:

**Phase 1 — Infrastructure layer:**
Database, event bus, corpus ingestion pipeline. Verify each with health checks before proceeding.

**Phase 2 — Corpus consistency:**
Verify corpus integrity via hash chain check. Identify and reconcile any gaps.

**Phase 3 — PRE runtime:**
Restore PRE execution. Verify determinism via comparison run on recent corpus events.

**Phase 4 — Governance kernel:**
Restore governance kernel. Verify it is making correct decisions by replaying a test set.

**Phase 5 — API surface:**
Restore operator API surface. Verify with synthetic requests.

**Phase 6 — Operator sessions:**
Allow operators to reconnect. Brief active operators on what occurred.

**Phase 7 — Venue reconnection:**
Venues reconnect through the reconnection sequence (see DEGRADED-NETWORK-AND-DISCONNECTED-OPERATIONS-v1.md §9).

**Phase 8 — Full operations declared:**
Only after all venues are reconnected and corpus consistency is confirmed.

### 6.3 Recovery Pacing

Recovery pacing is the governance of how quickly restoration proceeds. Rushing recovery creates "recovered but fragile" states that fail again under load.

Pacing requirements:
- Each phase is held for a minimum observation window (10 minutes for infrastructure phases, 5 minutes for application phases) before the next phase begins
- The observation window confirms stability, not just initial success
- Any anomaly detected during an observation window pauses the recovery and triggers investigation

---

## 7. Replay-Backed Recovery Validation

### 7.1 What Replay-Backed Validation Means

Before declaring recovery complete, the system validates that its restored state is consistent with the corpus record of what the state should be.

Recovery that produces a system state that does not match the corpus record is not valid recovery — it is an undocumented divergence. It must be investigated, not declared as complete.

### 7.2 Validation Protocol

**Step 1 — State snapshot:** A snapshot of the current system state is taken.

**Step 2 — Corpus replay to current:** The corpus is replayed forward from the last verified anchor to produce the expected current state.

**Step 3 — State comparison:** The current state and the replay-derived expected state are compared.

**Step 4 — Divergence classification:** Any differences are classified:
- ACCEPTABLE: within declared tolerance (timing differences, non-governance state)
- EXPLAINABLE: difference is explained by declared recovery actions
- UNEXPLAINED: difference cannot be explained by known events

**Step 5 — Divergence resolution:** UNEXPLAINED differences must be resolved before recovery is declared. EXPLAINABLE differences are annotated in the corpus. ACCEPTABLE differences are logged.

### 7.3 Validation Failure Response

If replay-backed validation reveals UNEXPLAINED divergence:
- Recovery is paused
- The divergence is investigated
- Recovery does not proceed until the divergence is classified

"It looks fine" is not a substitute for passing validation. A system that looks fine but has unexplained divergence from its corpus record is operating outside verified state.

---

## 8. Cross-Region Rollback Governance

### 8.1 When Rollback is Needed

Rollback may be needed when:
- A recovery action has made the situation worse
- A deployment during recovery has introduced a regression
- A configuration change during recovery has produced unexpected behavior
- An attempted corpus reconciliation has produced further inconsistency

### 8.2 Rollback Authority

Cross-region rollback requires Cross-Regional Incident Authority (§2.1). No region may initiate a cross-region rollback without explicit authorization from the incident commander.

The authorization must be:
- Explicit (not implied by proximity or urgency)
- Recorded in the incident corpus record
- Accompanied by the specific rollback target (to what state; at what timestamp)

### 8.3 Rollback Sequencing

Rollback is the reverse of recovery sequencing: restore from the smallest scope inward, in reverse dependency order.

**Phase 1 — Operator surfaces:** Restrict to read-only to prevent further operations during rollback.

**Phase 2 — API surface rollback:** Restore previous API version or configuration.

**Phase 3 — Governance kernel rollback:** Restore previous governance configuration.

**Phase 4 — Corpus state:** The corpus is append-only and cannot be rolled back. However, events written during the failed recovery period are annotated RECOVERY_PERIOD and their operational effects are declared superseded.

**Phase 5 — Infrastructure:** Restore previous infrastructure configuration.

**Phase 6 — Validation:** Full replay-backed validation of the rolled-back state.

### 8.4 Rollback Corpus Record

The rollback itself is recorded in the corpus: what was rolled back, to what state, by whom, under what authority, and why. The rollback record references the recovery actions that were reversed. This full record enables future forensic analysis to understand the complete event sequence.

---

## 9. Recovery Confidence Classification

Every recovery state is classified by its confidence level:

### 9.1 Recovery Confidence States

**RECOVERED_VERIFIED:**
Recovery is complete. Replay-backed validation passed. All phases of recovery sequence complete. Infrastructure at NOMINAL. Operator briefings complete.

**RECOVERED_UNVERIFIED:**
Operations have been restored but replay-backed validation has not been completed. The system appears functional but consistency with corpus state is unconfirmed.

**RECOVERED_PARTIAL:**
Recovery sequence partially complete. Some capability classes are restored; others remain restricted. Specific available and restricted capabilities are declared.

**RECOVERED_UNDER_OBSERVATION:**
Recovery appears complete but the observation window has not expired. Infrastructure metrics are being monitored for stability. Operations are permitted but operators are asked to report unusual behavior.

**RECOVERED_BUT_UNTRUSTED:**
Operations have been restored but the system holds divergence from its corpus state that has not been explained. Operations may proceed but all actions are flagged for post-recovery review (see §10).

**RECOVERY_STALLED:**
Recovery is in progress but a phase has not completed within its expected window. Investigation is active. Partial operations available.

### 9.2 Confidence Classification Display

Recovery confidence state is displayed on all operational surfaces until RECOVERED_VERIFIED is declared. It is never hidden in a detail view during an active recovery.

---

## 10. "Recovered but Untrusted" Operational State

### 10.1 What This State Means

RECOVERED_BUT_UNTRUSTED is not a failure state. It is an honest acknowledgment that operations have been restored before full verification is complete, and that the restored operations are proceeding on the basis of state that has not been confirmed consistent with the corpus record.

This state exists because operational necessity sometimes requires resuming operations before every validation step is complete. A venue that has been offline for 4 hours may need to serve its scheduled program even if corpus reconciliation is still in progress.

### 10.2 RECOVERED_BUT_UNTRUSTED Behavioral Requirements

While in this state:
- All operational surfaces display RECOVERED_BUT_UNTRUSTED with the specific basis for the untrusted status
- All operator actions during this state are tagged UNTRUSTED_BASIS in the corpus
- Governance decisions that would normally require TIER 1 truth basis are flagged as requiring post-recovery review
- Operations do not stop — but the record is transparent about the epistemic conditions under which they proceeded

### 10.3 Resolving RECOVERED_BUT_UNTRUSTED

The state resolves when:
- Replay-backed validation completes and finds no UNEXPLAINED divergence, OR
- UNEXPLAINED divergence is investigated and classified (either resolved or annotated as known and accepted)

The state does not resolve through timeout or declaration. It resolves through evidence.

---

## 11. Incident Communication Contracts

### 11.1 Communication Obligations

During a distributed incident, all parties have communication obligations:

**Incident Commander obligations:**
- Initial incident declaration broadcast within 15 minutes of incident detection
- Status update every 30 minutes until resolution
- Immediate notification of scope changes, authority transfers, and significant decision points
- Final incident close broadcast with summary

**Regional Liaison obligations:**
- Regional status updates every 15 minutes
- Immediate notification of partition, reconnection, or local escalation events
- Confirmation of receiving and understanding commander communications

**Venue Operator obligations:**
- Local status updates every 30 minutes during extended incidents
- Immediate notification of capability changes at the venue
- Confirmation of receiving and understanding regional communications

### 11.2 Communication Failure Protocol

If communication with the incident commander is lost:
- The last known incident state is assumed to remain valid
- Local teams continue executing the last confirmed plan within their authority
- No new cross-scope actions are taken without communication
- When communication is restored, a status reconciliation is conducted before new cross-scope actions proceed

### 11.3 Communication Channel Priority

Communications are routed in channel priority order:
1. Primary incident channel (control plane)
2. Secondary incident channel (backup communication path)
3. Out-of-band emergency channel
4. Individual direct contact (phone, etc.)

When lower-priority channels are used, the reason (higher-channel failure) is noted in the incident record.

---

## 12. Cross-Region Operator Synchronization

### 12.1 The Synchronization Problem

During a distributed incident, operators in different regions may have different pictures of the incident state. An operator in Region A who takes an action based on their view may conflict with an operator in Region B taking an action based on theirs.

Cross-region operator synchronization ensures that all operators working on the same incident share a common operational picture.

### 12.2 Shared Incident View

All operators actively responding to a distributed incident access a shared incident view:
- The same incident record
- The same action log
- The same authority declarations
- The same current status assessment

The shared incident view is the single source of truth for the incident. Operators do not maintain parallel private incident records.

### 12.3 View Divergence During Partition

When a partition prevents operators from accessing the shared view:
- Each operator maintains a local incident record in their region's corpus
- Both operators declare their local view explicitly (what they know, when they last had shared information)
- On partition resolution, both local records are merged into the shared view
- Conflicts in the merged view are surfaced for review (not silently resolved)

### 12.4 Operator Acknowledgment Protocol

Critical incident communications require explicit acknowledgment:
- A status update that changes the incident scope or authority requires acknowledgment from all parties
- An operator who has not acknowledged within 10 minutes is assumed to not have received the communication
- The incident commander escalates to the unacknowledged operator's backup

---

## 13. Recovery Observability Requirements

### 13.1 What Must Be Observable During Recovery

Recovery observability is the ability for all involved parties to see what recovery is doing, what has been completed, and what the current state of the system is.

**Recovery phase tracking:**
Each phase of the recovery sequence (§6.2) is tracked and visible:
- Current phase
- Time in current phase
- Phase status (in progress / waiting for observation window / completed / stalled)
- Progress within phase (where measurable)

**Validation status:**
Results of each validation check are visible immediately:
- Hash chain check: pass / fail / pending
- PRE determinism check: pass / fail / pending
- State comparison: pass / divergence-found / pending

**Infrastructure metrics:**
Real-time infrastructure health (see INFRASTRUCTURE-OBSERVABILITY-AND-RUNTIME-TRUST-v1.md §3) during recovery to detect instability before it causes a regression.

**Action log:**
Every action taken during recovery is logged with timestamp, actor, scope, and outcome. The log is visible to all parties in the incident.

### 13.2 Recovery Observability During Degraded Infrastructure

If the infrastructure used to provide observability is itself degraded:
- Observability degradation is declared explicitly
- Operators are told which recovery observability dimensions are unavailable
- Monitoring proceeds through available channels only
- Validation steps that cannot be observed are deferred until observability is restored or manually executed with Tier 3 attestation

Recovery observability failure does not halt recovery. It restricts it: phases that cannot be validated cannot be declared complete.

---

## 14. Anti-Chaos Recovery Governance

### 14.1 What is Anti-Chaos Recovery

Chaos in recovery occurs when multiple operators take simultaneous uncoordinated actions in the belief that more action means faster resolution. In complex distributed systems, this intuition is frequently wrong. Simultaneous uncoordinated actions produce:
- Conflicting state changes that are harder to understand than the original failure
- Races between recovery actions where the outcome depends on which action completes first
- Masking of the actual failure signal by the recovery noise
- Operators who cannot reconstruct what happened because too many things changed at once

Anti-chaos recovery governance prevents this.

### 14.2 Anti-Chaos Rules

**One recovery action at a time.** During the recovery sequence, only one phase is being actively executed at a time. Phase N+1 does not begin until Phase N is confirmed complete.

**No parallel recovery tracks.** If two recovery paths are being considered, one is selected by the incident commander. The other is documented but not executed simultaneously.

**Recovery actions require commander authorization.** No operator takes a recovery action without it being authorized by the incident commander and logged in the incident record.

**Reversal before next attempt.** If a recovery action fails, it is reversed before the next attempt is made. A partially executed failed action is not left in place while the next action begins.

**Five-minute hold after unexpected behavior.** If the system behaves unexpectedly during recovery (output different from expected), the recovery is paused for a five-minute assessment before proceeding.

### 14.3 Anti-Chaos Authorization

Authorization for each recovery action is explicitly logged:
- What action
- Who authorized it
- The basis for authorization (what information supported the decision)
- The expected outcome
- The actual outcome

This authorization log makes the recovery sequence reconstructable by any party after the fact.

---

## 15. Incident Fatigue Across Prolonged Outages

### 15.1 What is Incident Fatigue

Prolonged outages — those lasting more than 4 hours — create incident fatigue in operational teams. Fatigue produces:
- Degraded decision quality (cognitive resources depleted)
- Increased risk-taking (urgency to resolve overrides caution)
- Communication failure (key information not shared)
- Premature resolution declaration (desire to be done overrides verification)

Incident fatigue is a real operational risk. It is not a character weakness. It is a predictable consequence of sustained high-cognitive-load operation.

### 15.2 Fatigue Governance Requirements

**Mandatory relief rotation for incidents exceeding 4 hours.**
At the 4-hour mark, the incident authority holder transfers authority to a fresh operator. The handoff follows the RCT protocol (§3.2). The original holder moves to advisory status.

**6-hour check for all active response operators.**
At 6 hours, all operators who have been continuously active for that period are replaced or supplemented by fresh operators. No operator who has been continuously active for 6 hours makes critical recovery decisions without a fresh second.

**Documentation checkpoint at 2-hour intervals.**
Every 2 hours, the incident state is fully documented: current status, all actions taken, all information known, all uncertainties. This documentation serves multiple purposes: it supports the handoff, it creates a record, and it forces the active team to articulate what they actually know vs. what they believe.

**Premature resolution prevention.**
Before declaring an incident resolved, a structured verification checklist is completed. The checklist cannot be abbreviated due to time pressure. If the team is too fatigued to complete the checklist, they are too fatigued to declare resolution.

### 15.3 Prolonged Outage Communication Cadence

During a prolonged outage:
- External stakeholders receive status updates every 2 hours
- Active operators receive internal briefings every hour
- The incident record is published in its current state to all involved parties at each 2-hour interval

Stakeholders who are waiting for resolution should have accurate expectations. Status updates that report "working on it" without content degrade trust and increase pressure on the operational team. Status updates should include: current understanding of the cause, current recovery phase, estimated time to next milestone, and known remaining risks.

---

## 16. Unsafe Restoration Conditions

The following conditions make restoration unsafe. Restoration must not proceed, or must be immediately paused, if any of these conditions are present:

1. **Hash chain break in the corpus window being recovered.** Restoring operations with a broken corpus chain means future forensic analysis will be unable to verify what happened during the incident window.

2. **Unexplained corpus divergence between regions.** Restoring operations when two regions hold different corpus content creates a state where the authoritative truth is unknown.

3. **PRE determinism violation during validation.** If the PRE runtime is not deterministic, replay guarantees are broken and future recovery will be significantly harder.

4. **Infrastructure instability during observation window.** If infrastructure metrics are oscillating during the observation window, the phase is not stable and should not be declared complete.

5. **Authority holder unavailable for final sign-off.** Restoration requires the incident commander or their designated successor to confirm completion. Restoration without authority holder sign-off is incomplete.

6. **Active partition during restoration.** Restoring a region while it is partitioned from its PRIMARY means the restored region is operating on potentially incomplete state.

7. **Corpus ingestion pipeline degraded.** Restoring operations while the ingestion pipeline is degraded means events during the restoration window will not be properly recorded in the corpus.

8. **Clock synchronization not completed.** Restoring operations before clock synchronization means temporal ordering of events during the restoration window may be incorrect.

---

## 17. Constitutional Restrictions on Emergency Shortcuts

The following emergency shortcuts are unconditionally prohibited regardless of urgency or authority level:

1. **Skipping replay-backed validation to speed up recovery.** Validation is not optional. A system declared recovered without validation has an unknown relationship to its corpus record. Urgency does not change this.

2. **Manually editing corpus records to repair divergence.** The corpus is append-only. Divergence is repaired through reconciliation (annotation, supersession, resolution records). It is never repaired by modifying existing records.

3. **Silently absorbing split-brain events without human review.** Every split-brain event requires human review of the divergent decisions. No automatic merge algorithm is sufficient.

4. **Bypassing authority transfer protocols under time pressure.** Informal authority transfers (assumed authority without handoff protocol) create uncertainty about who is responsible for decisions. This uncertainty is itself an incident risk.

5. **Declaring recovery complete before the recovery sequence is finished.** The sequence exists to ensure stable recovery. Declaring completion while phases remain incomplete creates the appearance of recovery without its substance.

6. **Using simulation mode to mask live-system failures.** Simulation exists for training. It may not be used to present a functioning simulation to operators while the live system has failed.

7. **Suppressing infrastructure observability during recovery to prevent panic.** Operators must see the true state of infrastructure during recovery. Hiding degraded infrastructure metrics prevents operators from making correct decisions.

8. **Granting elevated authority permanently because it was needed temporarily.** Emergency authority grants are time-limited. They are not converted to permanent grants because they were useful during the incident.

9. **Closing an incident before all corpus annotations are complete.** The incident record in the corpus must be complete before the incident is closed. An incident closed with pending annotations has an incomplete operational record.

10. **Accepting a vendor's recovery declaration without independent verification.** A vendor reporting "infrastructure restored" is a TIER 4 report (human report, unverified). It must be confirmed by TIER 1 evidence (corpus validation) before restoration is accepted.

---

## 18. Twelve Named Distributed Incident Scenarios

These 12 named scenarios define the primary distributed incident patterns that the operational team must be prepared to manage. Each is used as a basis for drill and certification scenarios.

**DI-001 — REGIONAL_FAILOVER_UNDER_LOAD**
The PRIMARY region becomes unavailable during peak operational load. Multiple venues are mid-schedule. A SECONDARY region must assume PRIMARY authority while venues continue operating under local authority. Recovery requires coordinating failover while maintaining schedule continuity.

**DI-002 — MULTI_REGION_SPLIT_BRAIN**
A network partition causes two regions to each believe they hold PRIMARY authority. Both make independent governance decisions for 90 minutes before the partition resolves. Recovery requires full split-brain resolution protocol.

**DI-003 — CORPUS_INGESTION_STALL_DURING_INCIDENT**
During an operational incident, the corpus ingestion pipeline stalls. Events are occurring but are not being recorded. The operational team must manage the incident while knowing the corpus record is incomplete. Recovery requires both resolving the original incident and repairing the corpus record.

**DI-004 — CASCADING_VENUE_DISCONNECTION**
Network infrastructure failure causes multiple venues to enter PARTITIONED state simultaneously. Each venue must operate under local authority. The regional team must coordinate recovery while managing multiple simultaneous reconnection sequences.

**DI-005 — PARTIAL_CORPUS_CORRUPTION**
A hash chain break is detected in the corpus during a routine verification. The break affects a window covering 4 hours of operational events. Forensic investigation is required to determine whether the break is due to corruption or a bug. Operations during the affected window are under RECOVERED_BUT_UNTRUSTED status.

**DI-006 — AUTHORITY_HOLDER_UNAVAILABILITY_DURING_INCIDENT**
The primary Tier 3 authority becomes unavailable mid-incident without completing an authority transfer. The incident is authority-orphaned. The remaining team must invoke the authority orphan escalation protocol while managing an active incident.

**DI-007 — EXTENDED_PARTITION_SCHEDULE_GAP**
A venue's partition exceeds the 72-hour survivability horizon. The locally-loaded schedule runs out. The venue must invoke emergency content procedures and manage the schedule gap while working to restore connectivity.

**DI-008 — RECOVERY_REGRESSION**
A recovery action that appears successful causes a regression: the system enters a new failure mode worse than the original. The recovery sequence must be reversed, the regression investigated, and a different recovery path selected.

**DI-009 — CROSS_REGION_CONFLICTING_DECISIONS**
During a partition, two regions independently modify the same operational parameter (e.g., the schedule for a cross-region content package). The modifications conflict. When the partition resolves, both modifications are in the local corpus buffers. The reconciliation must resolve the conflict without silently adopting one version.

**DI-010 — PROLONGED_OUTAGE_FATIGUE**
A regional outage extends beyond 8 hours. The initial on-call team is fatigued. Authority handoffs must occur twice. The incident record spans multiple shifts. Communications to stakeholders must continue accurately despite the duration.

**DI-011 — SPLIT_RECONNECT_CONFLICT_FLOOD**
A venue reconnects after an extended partition and the local buffer contains a large number of events that conflict with regional decisions made during the partition. The reconciliation queue is large and requires hours of review. The venue must operate in RECOVERED_BUT_UNTRUSTED state while reconciliation proceeds.

**DI-012 — INFRASTRUCTURE_ILLUSION_MASKING_INCIDENT**
An infrastructure illusion failure (see INFRASTRUCTURE-OBSERVABILITY-AND-RUNTIME-TRUST-v1.md §17) masks the true severity of an incident. Operators are operating on the belief that the system is healthier than it is. When the illusion is detected, the true state is revealed and a new, larger incident scope is declared.

---

## 19. Recovery Anti-Patterns

The following recovery behaviors are documented as anti-patterns: approaches that appear helpful but reliably make recoveries worse.

**OPTIMISTIC_DECLARATION:** Declaring recovery complete before validation because the visible symptoms have resolved. Visible symptom resolution is not evidence of underlying health.

**PARALLEL_RECOVERY_TRACKS:** Running multiple recovery approaches simultaneously to find what works. This produces state changes that interact in unpredictable ways and makes the resulting state impossible to understand.

**UNDO_PANIC:** Immediately reversing every recovery action when one step fails, returning to a known-bad state and starting over. This can be appropriate, but only after the failed step is understood. Undoing without understanding may undo successful steps.

**THE_LATE_ESCALATION:** Waiting until the situation is critical before escalating to higher authority, depriving the higher authority of the time needed to be effective. Escalation should happen at the first indication that a resolution path is unavailable, not at the last.

**THE_EXPERTISE_WAIT:** Halting all recovery progress while waiting for a specific expert, when there are safe actions that non-experts can take. Recovery progress that does not require expertise should not stop waiting for expertise.

**THE_REPEATED_RETRY:** Repeating the same recovery action multiple times because it worked before. If the action is not working, the situation has changed. Understanding why is more productive than repeating.

**THE_UNDOCUMENTED_FIX:** Taking a recovery action that works but not documenting it. The next incident has the same knowledge gap.

**THE_CONFIDENCE_COLLAPSE:** A team that becomes unable to make decisions because confidence in the system is too low. This is addressed by scoping decisions to what can be verified: take actions only in the scope where ground truth is known, and expand scope as confidence is rebuilt.
