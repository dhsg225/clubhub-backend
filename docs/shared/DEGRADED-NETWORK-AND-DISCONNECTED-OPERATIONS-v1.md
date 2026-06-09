# Degraded Network and Disconnected Operations
## Governing Operation Under Unreliable, Delayed, Partitioned, or Absent Connectivity
### Version 1 — Phase K, Multi-Region, Network, and Infrastructure Resilience Era

---

## 1. Governing Principle

The network will fail. This is not a contingency to plan for — it is an operational reality to design around.

ClubHub TV operates in physical venues served by commercial internet infrastructure. That infrastructure is subject to congestion, hardware failure, ISP outages, weather events, facility problems, and maintenance windows. A platform that cannot operate under degraded connectivity is not a viable operational platform.

The design commitment is:

> **Venues must deliver their operational purpose even when disconnected. Operators must always know the confidence level of what they are seeing. "Unknown" is a first-class operational state, not a failure condition to hide.**

This document governs how the system behaves when connectivity is degraded, delayed, partitioned, or absent. It governs what operators can trust, what they can do, and what the system must surface rather than suppress.

---

## 2. Connectivity State Taxonomy

Every venue connection exists in one of the following declared states. These states are never inferred silently — they are determined by explicit probe results and declared on all operational surfaces.

### 2.1 State Definitions

**CONNECTED_NOMINAL:**
All channels functional. Latency within normal parameters. Corpus replication current. No buffering.

**CONNECTED_DEGRADED:**
Connectivity exists but performance is below nominal. Characterized by:
- Elevated latency (above declared threshold but below timeout)
- Reduced throughput (affecting large content transfers but not control operations)
- Intermittent packet loss within tolerance limits
All operations permitted. Large content operations flagged as potentially slow.

**CONNECTED_RESTRICTED:**
Connectivity exists but some channel types are non-functional. Examples: data channel operational, control channel degraded; or control channel operational, corpus replication channel non-functional. Operations that require non-functional channels are restricted. All restrictions are displayed.

**INTERMITTENT:**
Connectivity is present but unreliable — dropping and recovering within short windows. Operations that require sustained connectivity are restricted. Operations are queued for retry windows rather than failing immediately. Queue depth is visible.

**DELAYED_TRUTH:**
Connectivity exists but information arriving from the region is known to be delayed beyond the declared freshness threshold. Operators see data from the corpus but know it does not reflect the current moment. Freshness age is displayed with all data.

**PARTITIONED:**
No connectivity to the PRIMARY or SECONDARY region. The venue is operating on local authority. New local events are committed to the local buffer. See §5 for venue survivability.

**RECONNECTING:**
Connectivity has been restored after a PARTITIONED or INTERMITTENT state. The venue is in the process of synchronizing buffered events with the region corpus. Operations are available with declared lag. See §9 for reconnection sequencing.

**UNKNOWN:**
The venue's connectivity probing mechanism has itself failed, or probe results are contradictory. The venue cannot determine its connectivity state with confidence. This is a first-class operational state (see §6).

### 2.2 State Determination

Connectivity state is determined by:
1. Active probes to the PRIMARY region at the declared probe interval (default: 10 seconds)
2. Passive monitoring of corpus replication stream health
3. Control plane heartbeat monitoring

State transitions are logged with the probe evidence. State transitions do not occur based on a single probe failure — a configurable window of consecutive failures is required. Rapid state oscillation (CONNECTED → PARTITIONED → CONNECTED repeatedly) triggers INTERMITTENT declaration rather than state oscillation.

---

## 3. Degraded-Mode Operational Contracts

### 3.1 The Contract Model

A degraded-mode operational contract is a declared specification of what operators and the system commit to during each connectivity state. Contracts are not aspirational — they are enforced. If the system cannot meet a contract, it declares this explicitly.

### 3.2 CONNECTED_DEGRADED Contract

**System commits:**
- All governance operations proceed normally
- Corpus reads reflect the most recent replicated state (with lag declared)
- Large content transfers may be slow; ETA is surfaced
- All new events are committed to the corpus normally

**Operator may:**
- Take all normally permitted actions
- Be informed that large content operations may be slow

**System may not:**
- Suppress information about degraded throughput
- Present content delivery ETA as certain when transit is degraded

### 3.3 CONNECTED_RESTRICTED Contract

**System commits:**
- Operations on functional channels proceed normally
- Operations requiring non-functional channels are explicitly blocked with reason
- Affected channels and their dependencies are displayed

**Operator may:**
- Take all actions that do not require the restricted channel
- Explicitly acknowledge and defer channel-dependent operations

**System may not:**
- Route operations through a degraded channel silently hoping they succeed
- Hide channel restriction status

### 3.4 INTERMITTENT Contract

**System commits:**
- Operations are queued with declared queue depth and estimated processing time
- Operations are attempted in retry windows aligned with connectivity windows
- Queue contents are visible and operator-cancellable
- If an operation cannot complete within the declared timeout, the operator is notified

**Operator may:**
- View the operation queue
- Cancel queued operations
- Prioritize critical operations within the queue

**System may not:**
- Execute duplicate operations if a queued operation succeeds on retry
- Present operations as complete before confirmation is received

### 3.5 DELAYED_TRUTH Contract

**System commits:**
- All data is labeled with its age (time since corpus commit in the source region)
- Operations based on data older than the staleness threshold require explicit operator acknowledgment
- The staleness threshold is configured per data type based on operational relevance

**Operator may:**
- Take actions, with explicit acknowledgment that their information basis may be stale
- Request a freshness refresh (may take time; will be queued)

**System may not:**
- Present stale data as current
- Hide staleness indicators
- Remove acknowledgment requirements for stale-basis operations

---

## 4. Delayed-Truth Visibility Rules

### 4.1 Freshness Classification

Each data element on an operational surface carries a freshness classification:

| Classification | Age | Display Treatment |
|---|---|---|
| FRESH | Within 30 seconds of last confirmed sync | No indicator needed |
| RECENT | 30 seconds to 5 minutes | Subtle freshness indicator |
| AGING | 5 to 30 minutes | Prominent freshness indicator with age |
| STALE | 30 minutes to 4 hours | Warning indicator; acknowledgment required for actions |
| VERY_STALE | 4 hours to 24 hours | Strong warning; all actions require explicit stale-basis acknowledgment |
| HISTORICAL | Over 24 hours | All data visually distinguished; actions require Tier 3 authorization |

Thresholds are configurable per deployment but may not be loosened beyond 2x the defaults without Certification Authority review.

### 4.2 Stale-Basis Acknowledgment

When an operator takes an action based on data classified STALE or above, the system requires:
1. A displayed acknowledgment dialog showing the data age and last confirmed sync time
2. An explicit operator confirmation (not a timeout-based auto-accept)
3. The acknowledgment is recorded in the corpus event with the data age at decision time

This creates a transparent record: when a decision was made on stale information, the corpus shows exactly how stale the information was. This is essential for post-incident analysis.

### 4.3 What Staleness Does Not Mean

Staleness means information may not reflect the current state of the system. It does not mean the information is wrong. A schedule that was confirmed 45 minutes ago is stale but is very likely still the correct schedule.

Staleness indicators are not alarms. They are epistemic labels. Operators are trained (per CERTIFICATION-AND-SIMULATION-OPERATIONS-v1.md) to understand the difference between "I don't know if this is still current" and "this is incorrect."

---

## 5. Offline Venue Survivability

### 5.1 The Survivability Requirement

A venue must be able to execute its operational purpose for a minimum of 72 hours without any connectivity to the backend region. This is the survivability horizon.

72 hours covers:
- An overnight hardware failure discovered at business end and repaired the next morning
- A weekend ISP outage
- A facility network failure that requires contractor repair

### 5.2 What Must Survive

**Schedule execution:** The venue must be able to execute its scheduled content program for the survivability horizon. This requires the venue device to have the schedule loaded locally at least 72 hours forward.

**Emergency interrupt handling:** The venue must be able to receive and act on emergency interrupts through any available channel (see §15 for the communication fallback hierarchy).

**Operator access:** Local operators must be able to access operational surfaces, view the current state, and take permitted local actions.

**Corpus buffering:** All events occurring during the offline period must be buffered locally for synchronization when connectivity is restored. No events may be lost.

**Alert management:** Alerts generated during the offline period are stored locally and replayed to the region on reconnection.

### 5.3 What Does Not Survive

The following capabilities are not available during PARTITIONED state and operators must know this:

**Real-time regional coordination:** Cross-venue operations require connectivity. Actions are restricted to the local venue.

**New content approvals:** New content cannot be approved during partition (content approval requires PRIMARY region authority). Content scheduled before the partition proceeds; new additions require reconnection.

**Cross-region operator sessions:** An operator authenticated to a regional session cannot initiate new sessions from a partitioned venue. Existing sessions are preserved locally until they expire.

**Remote configuration changes:** Configuration changes originating outside the venue are not received during partition.

### 5.4 Survivability Horizon Monitoring

The venue continuously tracks and displays:
- Schedule coverage: "Schedule loaded through [timestamp]" — operators know how long they can operate before schedule gaps appear
- Buffer capacity: "Local corpus buffer: [N] events / [capacity]" — operators know if buffer is nearing capacity
- Time since last sync: Visible at all times during PARTITIONED state

When schedule coverage drops below 24 hours, a SCHEDULE_COVERAGE_WARNING is generated. When it drops below 4 hours, a SCHEDULE_COVERAGE_CRITICAL alert triggers and operators must take action (find emergency content, restore connectivity, or escalate).

---

## 6. "Unknown" as a First-Class Operational State

### 6.1 The Prohibition on False Certainty

The most dangerous operational state is one where the system appears to know something it does not.

A system that confidently displays schedule information when its corpus connection has silently failed is not providing operators with useful information — it is providing operators with false confidence. The operator makes decisions based on a certainty that does not exist.

**Unknown is better than false confidence.** An operational surface that says "I cannot confirm the current state" gives the operator accurate information: they know they need to investigate or proceed with caution. An operational surface that says "everything is fine" when it doesn't know is operationally dangerous.

### 6.2 When UNKNOWN is Declared

UNKNOWN is declared when:
- Connectivity probing produces contradictory results (some probes succeed, some fail, in a pattern inconsistent with declared connectivity states)
- The corpus connection appears functional but events are not being received (silent failure of the replication stream)
- Clock synchronization has failed and the venue cannot determine its clock's accuracy
- The system's own self-monitoring has produced errors that prevent accurate state assessment

### 6.3 UNKNOWN State Behavior

When a venue is in UNKNOWN connectivity state:
- All operational surfaces display CONNECTIVITY_UNKNOWN prominently
- Operations that depend on current-state knowledge are restricted pending resolution
- Local operations that do not require confirmed connectivity (reading the local corpus, taking locally-authorized actions) are permitted
- The self-monitoring failure is logged and an alert is generated for the region (if reachable)
- The venue does not optimize its way out of UNKNOWN by assuming a more favorable state

### 6.4 Resolving UNKNOWN

UNKNOWN resolves when:
- Probe results become consistent and match a declared connectivity state
- An operator at Tier 3 explicitly assesses the state and declares a working assumption (logged as OPERATOR_STATE_ASSESSMENT)
- Connectivity is restored to a point where state can be confirmed

An operator state assessment is not a system determination. It is an explicit human override with acknowledged uncertainty. The corpus records both the UNKNOWN state and the assessment basis.

---

## 7. Operator Trust Preservation During Disconnect

### 7.1 The Trust Problem

When a venue loses connectivity, operators face a dual challenge:
1. They must continue to operate
2. They cannot be certain that their operational information is current

The system's responsibility during disconnect is not to simulate confidence it does not have. Its responsibility is to be a reliable partner in uncertainty — accurately communicating what is known, what is unknown, and what can be trusted.

### 7.2 Trust-Preserving Behaviors

**Explicit state declaration:** The connectivity state is always displayed. Operators are never left to infer connectivity status from indirect signals.

**Accurate capability representation:** The system shows exactly what is and is not available. If content approval is unavailable, it is not grayed out without explanation — it shows "UNAVAILABLE: requires connectivity to PRIMARY" with the reason.

**Conservative default behavior:** When in doubt, the system restricts rather than permits. It is better to require an explicit operator override for an unusual action than to proceed based on potentially stale state.

**No progress theater:** If a background operation is waiting for connectivity to resume, the system does not show a progress spinner implying it is working. It shows "Waiting for connectivity — operation queued." Progress theater destroys trust when the queue never clears.

**Honest horizon statements:** "Schedule loaded through [timestamp]" is honest. "Schedule loaded and ready" without a time horizon is not, during PARTITIONED state, because the system cannot know whether content updates were expected.

### 7.3 Trust Restoration Protocol

When connectivity is restored, the system does not silently begin functioning as if nothing happened. It executes the reconnection sequence (§9) with explicit operator-visible progress, and restores full operational capability only when consistency is confirmed.

Premature restoration of capabilities before consistency is confirmed is a trust violation. It creates the appearance of full capability without the reality.

---

## 8. Synchronization Confidence Surfaces

### 8.1 The Confidence Surface Concept

A synchronization confidence surface is an operator-facing display that communicates the system's current confidence in the consistency of its local state with the authoritative regional state.

This is distinct from connectivity status. A venue may have connectivity but low synchronization confidence (if replication is stalled). A venue may be PARTITIONED but have high synchronization confidence for its local buffer (all events captured, nothing lost).

### 8.2 Confidence Dimensions

**CORPUS_SYNC_CONFIDENCE:**
- HIGH: corpus is confirmed consistent with PRIMARY up to declared lag
- MEDIUM: corpus is likely consistent but lag is above freshness threshold
- LOW: corpus has not synced within the STALE threshold
- UNKNOWN: corpus sync state cannot be determined

**BUFFER_INTEGRITY_CONFIDENCE:**
- HIGH: local buffer is intact, no gaps, known capacity remaining
- MEDIUM: buffer is intact but nearing capacity
- LOW: buffer capacity critical or integrity check warnings
- UNKNOWN: buffer integrity cannot be confirmed

**CLOCK_CONFIDENCE:**
- HIGH: clock synced within the last sync interval
- MEDIUM: clock drift below maximum permitted
- LOW: clock drift above maximum permitted; temporal ordering may be incorrect
- UNKNOWN: clock sync state cannot be determined

### 8.3 Composite Confidence

Operational surfaces display a composite confidence indicator derived from the minimum of all confidence dimensions. The composite is always the most conservative individual dimension — it never averages away low confidence in one dimension with high confidence in another.

---

## 9. Reconnection Sequencing

When a venue transitions from PARTITIONED or INTERMITTENT to a connected state, the reconnection sequence governs restoration.

### 9.1 Reconnection Sequence

**Phase 1 — Connectivity confirmation (automatic):**
Probe results are confirmed stable across a 60-second window before reconnection begins. Transient connectivity (a brief window in INTERMITTENT state) does not trigger reconnection sequence.

**Phase 2 — Clock resynchronization (automatic):**
Clock is resynchronized before any corpus operations. All subsequent events use the resynchronized clock. Events in the buffer that were timestamped with clock drift are annotated.

**Phase 3 — State divergence assessment (automatic with operator notification):**
The region is queried for the state of the corpus at the point of last sync. The local buffer is compared. The divergence window is calculated and displayed to operators.

**Phase 4 — Local buffer review (operator-visible, may require action):**
If the buffer contains any CONFLICT-classified events (see §10 for local-state quarantine rules), the operator is notified before reconciliation proceeds. The operator reviews the conflicts and authorizes resolution.

**Phase 5 — Buffer synchronization (automatic with progress display):**
Non-conflicting buffer events are submitted to the region corpus. Progress is displayed. The operator can see exactly which events are being submitted and their current status.

**Phase 6 — Corpus consistency confirmation (automatic):**
After buffer submission, a consistency check confirms that the local corpus is consistent with the regional corpus. Any remaining discrepancies are flagged for human review.

**Phase 7 — Capability restoration (declared):**
Each restricted capability is restored in sequence as the relevant consistency is confirmed. The operator sees capability restoration happening incrementally, not all at once. Full capability is declared only when all checks pass.

### 9.2 Reconnection Abort

If any phase produces results indicating a deeper problem (corpus conflict, buffer corruption, hash chain break), reconnection is paused and an alert is generated. The venue remains in RECONNECTING state, not silently returned to CONNECTED. The specific problem is displayed.

---

## 10. Local-State Quarantine Rules

### 10.1 What Requires Quarantine

Not all events in the local buffer can be safely submitted to the regional corpus upon reconnection. Events that may conflict with decisions made by the region during the partition window must be quarantined for review.

**Quarantine triggers:**
- Any event that modifies configuration that may also have been modified by the region
- Any event that represents a governance decision at the boundary of local authority
- Any event where the region has logged a conflicting event in the same window
- Any event where the timestamp cannot be verified due to clock uncertainty

### 10.2 Quarantine State

Quarantined events are held in a separate quarantine buffer:
- Not submitted to the regional corpus
- Not discarded
- Visible to operators with a clear QUARANTINED status
- Requiring explicit operator review and disposition

### 10.3 Quarantine Disposition

Each quarantined event must receive one of the following dispositions:

**ACCEPT:** The operator confirms this event should be incorporated into the corpus. The event is submitted with an OPERATOR_REVIEWED annotation.

**SUPERSEDE:** The operator determines this event has been superseded by a regional decision. The event is annotated SUPERSEDED and preserved in the corpus without executing its operations.

**CONFLICT:** The operator determines this event directly conflicts with a regional decision. The event is submitted to the regional split-brain resolution queue.

**DISCARD:** The operator determines this event is spurious or redundant. The event is annotated DISCARDED and preserved (not deleted) with the disposition basis.

No quarantined event may be silently absorbed or silently discarded. Every quarantined event receives an explicit disposition recorded by a Tier 3 operator.

---

## 11. Replay Buffering Guarantees

### 11.1 The No-Loss Guarantee

The system commits unconditionally: no event that occurs during a PARTITIONED or INTERMITTENT state is lost.

This guarantee is maintained through the local replay buffer. The buffer is:
- Written synchronously: events are written to the buffer before being considered committed locally
- Append-only: events in the buffer are never modified, only appended
- Hash-chained: the buffer maintains its own hash chain for integrity verification
- Capacity-monitored: buffer capacity is tracked and surfaced to operators

### 11.2 Buffer Capacity Management

The buffer has a declared maximum capacity. When the buffer reaches 80% capacity:
- BUFFER_CAPACITY_WARNING is generated
- Operators are advised to restore connectivity or take action to reduce event generation rate

When the buffer reaches 95% capacity:
- BUFFER_CAPACITY_CRITICAL is generated
- The system halts new buffer writes for non-essential event types
- Essential events (emergency interrupts, critical alerts) continue to be buffered
- Operators must take immediate action

### 11.3 Buffer Integrity

The buffer hash chain is verified at:
- Regular intervals during PARTITIONED operation
- At the start of each reconnection sequence

If the buffer hash chain has a break, BUFFER_INTEGRITY_FAILURE is declared:
- The break is identified exactly (which event is the first whose hash does not match)
- Events before the break are trusted
- Events after the break require review (they may be intact but cannot be verified without the chain)
- The operator is notified and reconnection does not proceed until the breach is assessed

---

## 12. Incident Handling While Disconnected

### 12.1 Incident Authority During Partition

During PARTITIONED state, incident handling operates under local authority. The highest available certified operator at the venue holds incident authority for the scope of that venue.

Incident authority during partition does not extend beyond the venue's physical scope. The local operator may not make decisions that would normally require cross-venue or cross-region coordination.

### 12.2 Incident Documentation Requirements

Every incident during PARTITIONED state must be documented in the local corpus buffer with:
- Incident start time (local clock with drift declaration)
- All actions taken
- The information basis for each action (what data was available, what was stale)
- The outcome as observed locally

This documentation is essential because the regional view of the incident will be incomplete until the buffer is reconciled.

### 12.3 Incident Continuation Across Reconnection

If an incident is active when connectivity is restored:
- The local incident record is shared with the region as the first priority in reconnection
- The region may have information about the same incident from other venues or monitoring systems
- The operator at the venue and the regional incident authority jointly review the combined incident record
- The incident is not considered closed until the combined record is reviewed

### 12.4 Discovered Incidents on Reconnection

Sometimes an incident that occurred during partition is only understood in context after reconnection — when the fuller picture is available.

These "discovered incidents" are investigated using the combined local and regional record:
- The local corpus buffer provides the venue's perspective
- The regional corpus provides the broader context
- The investigation acknowledges the information asymmetry that existed during the partition

---

## 13. Conflict Visibility During Resync

### 13.1 The Conflict Surface Requirement

When resynchronization reveals conflicts between local buffer events and regional events, those conflicts are displayed to operators before any automatic resolution. There is no silent conflict resolution.

The conflict display shows:
- The local event (what the venue decided)
- The conflicting regional event (what the region decided, or what state the region holds)
- The timestamp of each
- The data basis each decision was made on
- The operational implication of each resolution path

### 13.2 Conflict Categories

**TEMPORAL_CONFLICT:** Two events cover the same operational domain (e.g., schedule) at overlapping times. Both events claim authority for their window.

**STATE_CONFLICT:** The venue and region hold different beliefs about the current state of a system element (e.g., venue holds "device X is in state A"; region holds "device X is in state B").

**DECISION_CONFLICT:** The venue made a decision (e.g., schedule modification, configuration change) that contradicts a decision made by the region during the partition.

**AUTHORITY_CONFLICT:** The venue exercised authority it does not normally hold (because the normal authority was unreachable during partition) and the region exercised that same authority differently.

### 13.3 Conflict Resolution Governance

All conflicts require human review. The reviewing operator must be Tier 3 or above.

The resolution choices:
- Accept local event (venue's decision stands)
- Accept regional event (region's decision stands; venue event is annotated SUPERSEDED)
- Declare conflict unresolved (both events preserved; situation requires investigation)

The reviewer's choice and reasoning are recorded in the corpus alongside both events.

---

## 14. Network Degradation Observability

### 14.1 What Must Be Observable

Operators must be able to understand exactly what is happening with their network connection. Network observability is not optional — it is how operators decide what actions are safe to take.

Observable network dimensions:
- **Latency:** Current round-trip time to PRIMARY region, to SECONDARY region, and to content delivery infrastructure
- **Throughput:** Current bandwidth available for corpus replication and content delivery
- **Packet loss:** Percentage loss rate on each channel
- **Channel health:** Per-channel status (corpus replication, control plane, out-of-band monitoring)
- **Probe history:** Recent probe results (last 10) showing connectivity pattern
- **Buffer state:** Local buffer depth, capacity remaining, and submission queue status

### 14.2 Degradation Trend Visibility

Operators need to know not just the current state but whether conditions are improving or deteriorating:
- Each observable metric displays a trend indicator (improving / stable / degrading)
- Trend is calculated over the preceding 5-minute window
- A degrading trend that has not yet crossed a threshold is surfaced as a WARNING (conditions are getting worse even if not yet critical)

### 14.3 Degradation Timeline

The operational surface maintains a timeline of connectivity state changes for the current session:
- When each state transition occurred
- How long the venue has been in the current state
- Historical patterns (if this is a recurring degradation at similar times)

This timeline is part of the venue's operational record and is included in any incident investigation involving network issues.

---

## 15. Venue-Local Operational Authority

### 15.1 Scope of Local Authority

During PARTITIONED state, the venue operates under local authority. Local authority is:

**Inherent to the venue:**
- Executing the locally-loaded schedule
- Managing local devices within declared parameters
- Handling emergency interrupts received through local channels
- Documenting and buffering all events

**Extended by isolation configuration:**
- Local schedule modifications within the declared flexibility window (typically ±15 minutes)
- Emergency content substitution from locally available content
- Local device reconfiguration within declared parameter bounds

**Explicitly not granted (require connectivity):**
- New content approvals
- Changes to operational parameters beyond the flexibility window
- Cross-venue operations
- Permanent configuration changes

### 15.2 Local Authority Limits

Local authority is constrained to prevent partition from becoming an opportunity for unauthorized expansion of venue behavior. The limits are:
- Configured at deployment time
- Stored locally (the venue knows its own constraints)
- Cannot be self-extended (a venue cannot grant itself additional local authority)
- Displayed to operators as the "local authority profile"

### 15.3 Local Authority Record

Every action taken under local authority during PARTITIONED state is tagged LOCAL_AUTHORITY_EXERCISE in the corpus buffer. This tagging enables the regional governance review to quickly identify decisions that were made outside the normal authority chain.

---

## 16. Communication Fallback Hierarchy

When primary network connectivity is unavailable, communication must fall back through alternative channels. The hierarchy below declares the fallback order:

### 16.1 Channel Hierarchy

**Level 1 — Primary data network:**
Full bandwidth connection to regional infrastructure. All operations available.

**Level 2 — Secondary data network:**
Backup internet connection (separate ISP or LTE fallback). Full governance operations available; large content transfers may be limited.

**Level 3 — Control channel only:**
Low-bandwidth channel sufficient for governance decisions and alert exchange but not content delivery. Schedule execution continues from local content; content updates are not received.

**Level 4 — Emergency broadcast channel:**
One-way or severely restricted channel (e.g., SMS gateway, serial connection). Sufficient for emergency interrupt signals and critical status acknowledgment only. No corpus operations.

**Level 5 — Local only:**
No external communication. Venue operates entirely under local authority. All external communications are queued for when connectivity is restored.

### 16.2 Fallback Behavior

Each level in the hierarchy has a declared capability set. When falling back:
- The current channel level is displayed on all operational surfaces
- Capabilities not available at the current level are explicitly restricted
- Operators are not presented with controls they cannot use
- The expected capability restoration path is displayed ("Level 2 network: attempting reconnection")

### 16.3 Emergency Interrupt Delivery

Emergency interrupts are the highest-priority communication. They must be deliverable through any available channel:
- Level 1-3: normal interrupt delivery
- Level 4: emergency interrupt is a compact signal (minimal payload) that can traverse low-bandwidth channels
- Level 5: emergency interrupt from external sources cannot be received; local emergency authority applies (local operator judgment and local configured emergency content)

---

## 17. Forbidden Optimistic Behaviors

The following behaviors are explicitly forbidden because they create false confidence that leads to operational failures:

**SILENT_RECONNECT_ASSUMPTION:** Assuming connectivity has been restored before probe confirmation. If the last probe showed PARTITIONED, the state is PARTITIONED until a confirmed reconnect is observed.

**STALENESS_NORMALIZATION:** Treating data as current because it "probably hasn't changed." Staleness thresholds exist for a reason. The probability that data hasn't changed is not a substitute for the confirmation that it hasn't changed.

**QUEUE_COMPLETION_THEATER:** Displaying a queue as "complete" when operations in it have not been confirmed. If the queue has not been acknowledged by the region, it is still pending.

**OPTIMISTIC_CONFLICT_RESOLUTION:** Assuming that a conflict will resolve in favor of the local decision and proceeding as if the local decision is final before reconciliation is complete.

**CONNECTIVITY_ANTICIPATION:** Initiating operations that require connectivity before connectivity is confirmed, on the assumption that connectivity "should be restored by now."

**FALSE_IDLE:** Presenting the system as idle when it has pending operations in local buffers. If there are unsubmitted buffer events, the system is not in a clean state.

**LATENCY_SUPPRESSION:** Hiding elevated latency from operators on the grounds that it is "within acceptable range." Operators must be able to make informed decisions about whether to proceed with latency-sensitive operations.

**SILENT_RETRY:** Retrying failed operations without surfacing the failure and the retry to operators. Operators must know that an operation failed and is being retried, not discover later that it took 8 attempts.

---

## 18. Ten Named Degraded-Network Failure Modes

| ID | Name | Description | Safe Behavior | Unsafe Behavior |
|---|---|---|---|---|
| DN-001 | SILENT_STREAM_DEATH | The corpus replication stream stops receiving events but the channel appears connected | Declare DELAYED_TRUTH; surface freshness aging | Continue presenting corpus data as current |
| DN-002 | INTERMITTENT_SPLIT | Connectivity drops and restores within sub-minute windows, too fast for stable state declaration | Declare INTERMITTENT; queue operations | Alternate rapidly between CONNECTED and PARTITIONED, discarding queued operations |
| DN-003 | SPLIT_RECONNECT | Connectivity restores but the reconnection sequence is not initiated because the disconnect was brief | Execute reconnection sequence for any disconnect, regardless of duration | Skip reconciliation for "brief" disconnects |
| DN-004 | CLOCK_DRIFT_ACCUMULATION | An extended partition causes significant clock drift; events are timestamped incorrectly | Track and declare clock drift; apply correction on reconnection | Silently trust local clock; present potentially misordered events as authoritative |
| DN-005 | BUFFER_OVERFLOW | Local buffer fills during extended partition; newer events cannot be written | Surface BUFFER_CAPACITY_CRITICAL; halt non-essential buffer writes | Silently overwrite oldest events to make room |
| DN-006 | GHOST_CONNECTIVITY | A monitoring system reports the venue as connected when it is not (monitoring path and data path differ) | Use multiple independent probes; declare UNKNOWN if probes conflict | Trust the monitoring system's report and present as CONNECTED |
| DN-007 | CONFLICTING_SYNC | The venue successfully syncs from a SECONDARY region that has different state than PRIMARY | Declare the sync source and its lag; surface potential conflicts | Present SECONDARY-derived state as if it were PRIMARY-confirmed |
| DN-008 | PARTIAL_BUFFER_CORRUPTION | Only part of the local buffer fails its integrity check | Quarantine affected events; trust events before the corruption point | Submit all buffer events; present corrupted events as valid |
| DN-009 | REPLAY_DURING_RECONNECT | An operator initiates a replay during reconnection when the corpus is partially synchronized | Block replay of the unsynchronized window until reconciliation is complete | Allow replay of the unsynchronized window, presenting incomplete data as complete |
| DN-010 | AUTHORITY_DRIFT | Local authority is exercised in ways that exceed the configured local authority profile due to urgency | Escalate to highest available local Tier and log explicitly | Exercise any necessary authority and reconcile later without flagging the excess |

---

## 19. Safe Offline Operation Boundaries

### 19.1 What Is Safe

The following operations are safe during PARTITIONED state and do not require special authorization:

- Executing the locally-loaded schedule for events within the covered schedule window
- Reading the local corpus (with declared freshness)
- Taking notes and documenting observations in the local buffer
- Acknowledging alerts
- Taking locally-authorized device actions within declared parameters
- Emergency interrupt execution for interrupts received through available channels
- Escalating to local Tier 3 authority for locally-authorized decisions

### 19.2 What Is Unsafe

The following operations must be explicitly refused or flagged during PARTITIONED state:

- Any operation that claims to reflect current regional state (regional state is unknown)
- Any new content approval
- Any permanent configuration change that would normally require cross-region confirmation
- Any cross-venue operation
- Any action that requires knowledge of what other venues or regions have done during the partition

### 19.3 The Gray Zone

Some operations fall in a gray zone where local need may be urgent but authority is unclear. The governance for gray-zone decisions:

1. The local Tier 3 operator assesses the situation and documents the urgency basis
2. The operator explicitly acknowledges that they are acting outside normal authority due to operational necessity
3. The action is flagged URGENT_LOCAL_AUTHORITY_EXERCISE in the buffer
4. The action is submitted for regional review as the first item in the reconciliation queue on reconnection
5. The regional authority makes a final determination on whether the action was appropriate

Gray-zone decisions are not punished for being made. They are reviewed for whether the judgment was sound given the available information. The corpus preserves the information basis, which makes the review fair.
