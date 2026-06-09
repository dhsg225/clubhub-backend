# Infrastructure Observability and Runtime Trust
## Making Infrastructure State Operationally Explainable
### Version 1 — Phase K, Multi-Region, Network, and Infrastructure Resilience Era

---

## 1. Governing Principle

Infrastructure failure is inevitable. The operational question is not whether infrastructure will fail but whether operators will know what is happening when it does.

The central failure mode in operational platforms is not raw infrastructure failure — it is infrastructure that appears healthy while silently degrading. A platform that shows green dashboards while quietly dropping events, buffering indefinitely, or providing stale answers from healthy-looking caches is operationally worse than a platform that clearly shows its failures.

> **Operators must be able to trust what they see. A healthy-looking lie is not a feature — it is a liability.**

This document governs how infrastructure state is made observable, how confidence is communicated, and how the system presents uncertainty rather than false confidence when the underlying truth is degraded.

---

## 2. Infrastructure Trust Surfaces

### 2.1 The Trust Surface Concept

An infrastructure trust surface is a dedicated layer of operational display that communicates the health and confidence level of underlying infrastructure to operators in real time.

Trust surfaces are not the same as monitoring dashboards. A monitoring dashboard tells engineers what is technically wrong with infrastructure. A trust surface tells operators whether the information they are using to make operational decisions is reliable.

The distinction matters: an operator does not need to know that the corpus replication stream has a 400ms delivery delay. They need to know that the schedule they see on their screen may not reflect changes made in the last 8 minutes, and that any decisions based on that schedule carry that uncertainty.

### 2.2 Trust Surface Layers

**Layer 1 — Session trust:**
Is this operational session connected to the system it needs to be connected to? Is the authentication current? Is the session receiving real-time updates?

**Layer 2 — Data trust:**
Is the data being displayed sourced from a current, verified corpus state? What is its freshness? What is its confidence level?

**Layer 3 — Operation trust:**
When the operator takes an action, will it be received, processed, and confirmed by the appropriate authority? Or will it enter a queue, be silently held, or fail without visible indication?

**Layer 4 — Dependency trust:**
Are the infrastructure components that govern state (database, corpus, event bus, external content providers) operating within declared parameters? Or are they degraded in ways that affect the reliability of data presented at Layers 1–3?

### 2.3 Trust Surface Integration

Trust surfaces are integrated into operational displays, not separate from them. They appear:
- As a persistent status bar on every operational console (Layer 1 and 2 summary)
- As inline indicators on data elements (Layer 2 freshness/confidence)
- As action-level feedback before and after operator actions (Layer 3)
- As an accessible detail view for Layer 4 dependency health

---

## 3. Runtime Health Visibility

### 3.1 What Runtime Health Means

Runtime health is the operational health of the live system as it is executing — not as it was configured to behave. A system may be correctly configured but runtime-unhealthy due to:
- Elevated load causing response latency
- Queue backpressure causing event processing delays
- Memory pressure causing cache eviction and increased database load
- Dependency latency causing slow external calls

Runtime health is not a pass/fail binary. It is a spectrum with declared thresholds.

### 3.2 Runtime Health Dimensions

**PROCESSING_LATENCY:** The time from event submission to event committed in the corpus. Normal range declared per event type. Elevated latency does not mean events are lost — it means they are delayed.

**QUEUE_DEPTH:** The number of events waiting to be processed. A growing queue is the primary early warning signal of processing capacity problems.

**DATABASE_RESPONSE_TIME:** Response time for corpus read and write operations. Elevated database response time degrades all operations that depend on the corpus.

**EVENT_BUS_LAG:** The lag between an event being published to the event bus and being consumed by the governance kernel. Elevated bus lag means the governance kernel is operating on an older view of the system.

**CACHE_HIT_RATE:** For data that is served from cache, the ratio of cache hits to total requests. A declining cache hit rate indicates increased database load and potential for latency.

**EXTERNAL_DEPENDENCY_LATENCY:** Response time from external dependencies (content providers, authentication services, monitoring systems).

### 3.3 Health State Classification

For each runtime health dimension:

| State | Meaning |
|---|---|
| NOMINAL | Within declared normal parameters |
| ELEVATED | Above normal but below warning threshold; trending indicator shown |
| WARNING | Above warning threshold; operations may be affected; operator attention warranted |
| CRITICAL | Above critical threshold; operations are materially affected; intervention required |
| UNKNOWN | Health dimension cannot be measured; confidence in related operations is reduced |

### 3.4 Health Display

Runtime health is displayed on the infrastructure detail view with:
- Current state for each dimension
- Current value and its position relative to thresholds
- 15-minute trend graph
- Time at which the current state was last verified

---

## 4. Dependency Degradation Mapping

### 4.1 Dependency Map

Every component in the ClubHub TV runtime has declared dependencies. When a dependency degrades, the operational impact propagates to dependent components. The dependency map makes this propagation visible.

**Dependency declaration format:**
```
COMPONENT: GovernanceKernel
DEPENDENCIES:
  - CorpusDatabase [REQUIRED]: governance decisions cannot be recorded
  - EventBus [REQUIRED]: state change events cannot be propagated
  - AuthService [REQUIRED]: operator actions cannot be authorized
  - ContentMetadata [OPTIONAL]: schedule resolution may fall back to cached content
```

### 4.2 Cascading Degradation Rendering

When a dependency is degraded, the system renders the cascade:
- The degraded dependency is shown
- All components that depend on it are shown in degraded state with the reason
- The operational capabilities affected by each degraded component are listed

This cascade rendering prevents operators from seeing only symptoms without understanding causes. If schedule operations are slow, operators see: "Schedule operations slow → CorpusDatabase elevated latency → [cause if known]."

### 4.3 Impact Classification

For each dependency degradation, the operational impact is classified:

**CAPABILITY_DEGRADED:** The related capability still works but is slower or less reliable.
**CAPABILITY_RESTRICTED:** The related capability is operating in a restricted mode (e.g., read-only).
**CAPABILITY_UNAVAILABLE:** The related capability is not available.

Each classification is displayed alongside the affected capability, not buried in a technical health dashboard.

---

## 5. PRE-Runtime Trust Indicators

### 5.1 What is PRE-Runtime Trust

The PRE (Platform Replay Engine) is the system's deterministic execution backbone. PRE-runtime trust indicators communicate the confidence level of PRE execution to operational surfaces.

If PRE is executing correctly, operational decisions are deterministic and replay-consistent. If PRE-runtime trust is degraded, operators need to know that the execution they are observing may not be fully deterministic or replay-backed.

### 5.2 PRE Trust Dimensions

**CORPUS_BACKING:** Is PRE operating from a fully verified corpus, or is it executing from a partially synchronized or locally-buffered corpus?

**DETERMINISM_CONFIDENCE:** Has PRE's determinism been verified recently (via replay comparison)? How long ago was the last verification run?

**EXECUTION_CONSISTENCY:** Are PRE's outputs consistent across the active execution instances? Divergence between instances indicates a determinism problem.

**REPLAY_AVAILABILITY:** Is the replay infrastructure (corpus replication, hash chain verification) operational? If not, future replay is at risk even if current execution appears normal.

### 5.3 PRE Trust Indicator Display

PRE trust indicators are displayed on all operational surfaces that surface PRE-derived decisions:
- "PRE: Fully corpus-backed" — corpus is current, determinism verified
- "PRE: Operating from local buffer (N events unconfirmed)" — local buffer active; some determinism uncertainty
- "PRE: Determinism verification overdue (last: N hours ago)" — verification needs to run
- "PRE: DEGRADED — [specific issue]" — PRE is operating under conditions that reduce confidence

---

## 6. Queue and Backpressure Visibility

### 6.1 Queue Visibility Requirement

Every queue in the system that can affect operational response time or event processing order is visible to operators.

Queue visibility is not an engineering diagnostic tool — it is operational intelligence. A queue that is growing means future operations will be delayed. An operator who sees a growing event processing queue knows that their next action may take longer than normal to take effect, and can factor that into their decision.

### 6.2 Queue Observability

Each queue exposes:
- **Current depth:** Number of items waiting
- **Processing rate:** Items processed per minute (trailing average)
- **Oldest item age:** How long the oldest item has been waiting
- **Estimated drain time:** At current processing rate, how long to empty the queue
- **Growth trend:** Is the queue growing, stable, or draining?

### 6.3 Backpressure Propagation

When a downstream component is slow, upstream components experience backpressure — their operations are held rather than discarded. Backpressure propagation is visible:
- The slow downstream component is identified
- The upstream components experiencing backpressure are listed
- The operators whose operations are in the affected queues are notified

Backpressure is not failure. It is a capacity signal. But backpressure that is not surfaced looks like failures to operators whose operations do not complete in expected time.

### 6.4 Operation-Level Queue Feedback

When an operator submits an action, if that action enters a queue, the operator is immediately shown:
- "Action queued: [estimated wait time]"
- The queue depth at time of submission
- The action's estimated processing time when it reaches the front of the queue

When the action is dequeued and processed, the operator receives confirmation. They are never left wondering whether their action was received.

---

## 7. Replay Ingestion Health

### 7.1 What is Replay Ingestion Health

Replay ingestion health monitors the pipeline that captures operational events and writes them into the corpus. If this pipeline is degraded, events are being generated but may not be making it into the corpus in real time.

This is one of the most operationally dangerous degradation modes: the system appears to be working (operations are being executed) but the replay record is not being maintained. If the ingestion pipeline is degraded, the ability to investigate and replay what happened is compromised.

### 7.2 Ingestion Health Dimensions

**INGESTION_LAG:** Time between an event being committed by the governance kernel and that event appearing in the corpus. Normal: <100ms. Warning: >500ms. Critical: >2 seconds.

**INGESTION_RATE:** Events being ingested per minute. A sudden drop in ingestion rate without a corresponding drop in operational activity indicates a pipeline problem.

**INGESTION_BACKLOG:** Events waiting to be ingested. A growing backlog indicates the ingestion pipeline is not keeping pace with event generation.

**HASH_CHAIN_FRESHNESS:** Time since the hash chain was last extended. If the hash chain has not been extended in longer than the expected interval, ingestion may have stalled.

### 7.3 Ingestion Degradation Response

When ingestion health is degraded:
- All operational surfaces display CORPUS_INGESTION_DEGRADED
- Operators are informed that the replay record may not be complete for events in the degradation window
- Operations that critically depend on corpus integrity for their authority decisions are restricted
- The ingestion degradation window is marked in the corpus when ingestion is restored, so forensic analysis can correctly assess which events during that window have complete replay coverage

---

## 8. Event Propagation Observability

### 8.1 Event Life-Cycle Visibility

Each event in the system has a life cycle: generated → bus → consumed → processed → corpus. Operators need to know where an event is in this life cycle when operation feedback depends on it.

Event propagation observability exposes:
- Which stage the event is currently in
- How long it has been in that stage
- Whether the stage is behaving normally or is delayed

### 8.2 End-to-End Propagation Indicators

For operator-initiated actions, the system tracks and displays end-to-end propagation:
1. **Received:** Action received by the API surface
2. **Authorized:** Authority check completed
3. **Queued:** Action queued for processing
4. **Processing:** Governance kernel actively processing
5. **Committed:** Decision committed to corpus
6. **Propagated:** Decision propagated to affected venue devices
7. **Confirmed:** Device acknowledgment received

The operator sees progress through these stages. If progress stalls, the stall is visible with the stage and duration.

### 8.3 Propagation Failure Detection

If an event stalls at any stage beyond the declared stage timeout:
- A propagation stall alert is generated
- The operator whose action is stalled is notified
- The affected system component is highlighted in the dependency map
- The operator can choose to wait, retry, or cancel

Propagation stalls are never silently absorbed. They are surfaced and require operator disposition.

---

## 9. Infrastructure Causality Rendering

### 9.1 The Causality Requirement

When something goes wrong operationally, operators need to understand why. Infrastructure causality rendering surfaces the chain from root cause to operational impact in terms operators can act on.

This is distinct from the engineering-level causality visible in system logs. Engineering-level causality says "the database experienced a connection pool exhaustion at 14:23:07." Infrastructure causality rendering says "schedule operations are slow because the database is under load. The delay is approximately 4 seconds. Operations are queued and will complete in estimated 2 minutes."

### 9.2 Causal Narrative Format

Infrastructure causality is rendered as a causal narrative with three components:

**What is affected:** The operational capability that is degraded (not the technical component).

**Why it is affected:** The infrastructure cause, expressed in operational terms.

**What to expect:** The operational implication — what will work, what is slow, what is unavailable, and the estimated duration or recovery path.

Example:
> "Schedule operations are slow (approx. 8 second delays). Cause: database response time is elevated due to high load from a reporting query. Expected recovery: 3-5 minutes as the query completes. All schedule operations will complete; they are queued."

### 9.3 Causality Update

As the infrastructure situation evolves, the causal narrative updates:
- When the root cause is resolved, the narrative updates to reflect recovery
- If the situation worsens, the narrative is updated with the new impact assessment
- If recovery is taking longer than estimated, the estimate is updated, not silently abandoned

---

## 10. "Healthy-Looking Degradation" Prohibition

### 10.1 The Most Dangerous Failure Mode

A system that appears healthy while performing poorly is more dangerous than a system that is visibly failing. When a system appears healthy, operators make decisions based on the assumption that the data they are seeing is reliable and that their actions are taking effect normally.

Healthy-looking degradation includes:

**Cache hits presenting stale data as current.** A cache that is serving data from 45 minutes ago appears just as fast as a cache serving fresh data. The operator sees instant responses and assumes currency.

**Queued operations appearing complete.** An operation that has been accepted into a queue but not yet processed appears from the submission side as if it was acted on immediately.

**Silent retry masking failure.** A system that retries failed operations without surfacing the retry eventually succeeds, but the operator never learns that the operation failed 7 times first. This masks reliability problems.

**Progress bar theater.** A progress indicator that does not reflect actual progress — that moves at a fixed rate regardless of actual completion — gives the operator false confidence about completion time.

**Green dashboards from lagged monitoring.** A monitoring system that checks health every 5 minutes will show green for up to 5 minutes after a failure begins.

### 10.2 Prohibition Enforcement

The following behaviors are explicitly prohibited:

1. Serving data from cache without labeling it as cached and declaring its age.
2. Completing an operation acknowledgment before the operation has been processed (not just received).
3. Retrying operations more than 2 times without surfacing the failure state to the operator.
4. Displaying a progress indicator that is not derived from actual processing progress.
5. Reporting infrastructure health based on checks that are more than 30 seconds old without declaring the check age.
6. Displaying aggregate health indicators that are green when any individual component contributing to that aggregate is in WARNING or above.

---

## 11. Infrastructure Confidence Scoring

### 11.1 Confidence Score Purpose

The infrastructure confidence score is a composite indicator that surfaces the system's confidence in its own current health state. It is not a performance metric. It is an epistemic indicator: "how confident are we that what we are showing you is accurate?"

### 11.2 Confidence Score Dimensions

The confidence score is computed from:

| Dimension | High Confidence | Low Confidence |
|---|---|---|
| Health check freshness | All checks within 30s | Any check older than 2m |
| Corpus ingestion lag | <100ms | >2s |
| PRE determinism verification | Verified within 24h | Not verified within 72h |
| Dependency health | All NOMINAL | Any CRITICAL |
| Queue depth | All queues draining | Any queue growing rapidly |
| Connectivity state | CONNECTED_NOMINAL | Any non-NOMINAL state |

### 11.3 Confidence Score Display

The composite confidence score is displayed as a simple indicator on all operational surfaces:

**FULL CONFIDENCE:** All dimensions high. No qualifications.

**HIGH CONFIDENCE:** All dimensions high or nominal; minor check age. "Infrastructure appears healthy; routine conditions."

**MEDIUM CONFIDENCE:** Some dimensions elevated or checks are older. Specific qualifications displayed. "Infrastructure: 2 dimensions elevated. See details."

**LOW CONFIDENCE:** One or more dimensions in WARNING or CRITICAL, or significant check age. Operations proceed with explicit qualification. "Infrastructure confidence low: [specific reasons]."

**UNKNOWN CONFIDENCE:** Confidence dimensions themselves cannot be measured. "Infrastructure status cannot be assessed. Proceed with caution."

---

## 12. Runtime Uncertainty Communication

### 12.1 Uncertainty as Information

Uncertainty is information. An operator who knows that the system is uncertain about a fact can proceed differently than an operator who falsely believes the system is certain. Hiding uncertainty deprives operators of the ability to calibrate their decisions appropriately.

Runtime uncertainty communication is the active surfacing of uncertainty in operational displays, not its suppression.

### 12.2 Uncertainty Categories

**DATA_FRESHNESS_UNCERTAINTY:** The displayed data may not reflect the current state due to replication lag, cache age, or staleness.

**OPERATION_COMPLETION_UNCERTAINTY:** An operation has been submitted but not confirmed. It may or may not have taken effect.

**INFRASTRUCTURE_STATE_UNCERTAINTY:** The infrastructure's health cannot be fully verified; displayed health indicators may be stale.

**CAUSAL_UNCERTAINTY:** An incident or degradation has been detected but its cause has not been confirmed.

**RECOVERY_UNCERTAINTY:** A recovery procedure has been initiated but completion cannot be confirmed.

### 12.3 Uncertainty Display Contract

When any uncertainty category is active:
- Affected data elements are labeled with their uncertainty type
- The basis for the uncertainty is declared (e.g., "Data freshness uncertainty: last corpus sync 12 minutes ago")
- Actions based on uncertain data require explicit operator acknowledgment
- Uncertainty labels are removed when the uncertainty is resolved

---

## 13. Operator-Facing Infrastructure Narratives

### 13.1 The Narrative Requirement

Technical health indicators (status codes, percentages, thresholds) are appropriate for engineers but are not the primary communication channel for operators making operational decisions.

Operators need infrastructure narratives: plain-language explanations of what is happening, what it means for their work, and what they should expect.

### 13.2 Narrative Triggers

Infrastructure narratives are generated and displayed when:
- A health dimension transitions from NOMINAL to ELEVATED or higher
- A confidence score drops below HIGH CONFIDENCE
- A dependency enters a degraded state
- Connectivity state changes
- An operation fails or stalls
- Infrastructure state returns to normal (recovery narrative)

### 13.3 Narrative Format

Each narrative contains:
- What is happening (one sentence, operational impact focus)
- How it affects current operations (specific capabilities affected)
- What the operator should do differently, if anything
- What the system is doing about it
- Estimated resolution time (if determinable)

Narratives are updated as the situation evolves. Outdated narratives are marked stale and replaced, not silently removed.

### 13.4 Narrative Accumulation

When multiple infrastructure issues occur simultaneously, narratives are consolidated into a coherent summary rather than producing an overwhelming list. The most operationally significant issue leads the narrative. Secondary issues are listed briefly.

---

## 14. Hidden-Failure Prevention

### 14.1 Categories of Hidden Failure

Hidden failures are failures that occur but are not surfaced to operators within a declared time window. They are the primary source of "why didn't anyone notice until it was too late" incidents.

**Category 1 — Ingestion pipeline silence:**
Events occur but are not ingested into the corpus. The system continues operating but is no longer maintaining a replay record.

**Category 2 — Dead letter accumulation:**
Events that cannot be processed are silently moved to a dead letter queue. The queue grows indefinitely without visible impact on normal operations until it causes storage or performance issues.

**Category 3 — Cache staleness drift:**
A cache becomes progressively more stale due to a failed cache invalidation mechanism. Operators continue seeing fast responses that are increasingly out of date.

**Category 4 — Watchdog suppression:**
A health check that is supposed to detect problems is itself non-functional, producing false-healthy readings.

**Category 5 — Partial consensus:**
A distributed consensus mechanism is functioning for most components but one component has silently diverged, producing decisions that appear valid but are inconsistent.

### 14.2 Prevention Architecture

**For ingestion pipeline silence:**
- Corpus ingestion rate is monitored; a drop below minimum expected rate triggers INGESTION_STALL alert regardless of pipeline health indicators.

**For dead letter accumulation:**
- Dead letter queues have declared maximum size; exceeding 10% of maximum triggers alert; approaching maximum triggers escalation.

**For cache staleness drift:**
- Every cache has a maximum age limit; entries that exceed the limit are proactively invalidated rather than silently retained.

**For watchdog suppression:**
- Health checks themselves are health-checked via a separate monitoring path (watchdog of the watchdog). If the monitoring system has not produced a fresh health report within the expected interval, an alert is generated.

**For partial consensus:**
- Consensus verification includes a divergence check; a component that has not participated in consensus within the expected interval is surfaced as potentially diverged.

---

## 15. Infrastructure Replay Integration

### 15.1 Why Infrastructure Events Belong in the Corpus

Infrastructure events — component degradations, health transitions, connectivity changes, recovery events — are governance-relevant. When investigating an incident, understanding that the database was at 95% capacity when an operator made a decision provides essential context. If infrastructure events are only in separate monitoring systems, this context is lost.

### 15.2 Infrastructure Events in the Corpus

The following infrastructure events are committed to the corpus as first-class governance events:

- Connectivity state transitions
- Component health state transitions (NOMINAL → WARNING, WARNING → CRITICAL, etc.)
- Queue depth threshold crossings
- Confidence score transitions
- Dependency degradation and recovery events
- Ingestion pipeline health events
- PRE determinism verification results

These events are committed to the corpus with the same hash-chain integrity as operational governance events.

### 15.3 Infrastructure Replay Use

When a forensic investigation uses replay, infrastructure events are available for correlation:
- "The operator made decision X at time T; at that time, the corpus had not been updated for 12 minutes (DELAYED_TRUTH state)"
- "The schedule appeared correct on the operator's surface, but the content delivery system had been in WARNING state for 8 minutes"

Infrastructure replay integration makes the operational context visible during forensic analysis.

---

## 16. Operational Blast-Radius Visibility

### 16.1 What is Blast Radius

The blast radius of an infrastructure failure is the scope of operational capabilities, venues, and decisions that are affected by that failure.

An operator who knows that a database degradation affects only analytics operations will behave differently from an operator who does not know whether the same degradation might affect schedule execution.

### 16.2 Blast-Radius Assessment

When an infrastructure failure occurs, the blast-radius assessment surfaces:
- Which venue operations are affected
- Which capability categories are affected (schedule execution, content approval, operator sessions, etc.)
- Which events currently in progress may be affected
- Which operators currently active may see degraded functionality

### 16.3 Blast-Radius Display

The blast-radius is displayed in the infrastructure narrative:
> "Database elevated latency affects: schedule queries (slow), corpus reads (slow). Does NOT affect: schedule execution (running from device cache), emergency interrupt handling (local authority)."

Operators know what they can rely on and what they should avoid or approach with caution.

### 16.4 Blast-Radius Contraction

As the infrastructure issue is resolved, the blast radius contracts. The operational narrative shows each capability being restored, not just a single "all clear" at the end. Operators can resume affected operations as each capability is restored.

---

## 17. Named Infrastructure Illusion Failures

These are named failure modes where infrastructure appears healthier than it is. Each is named to enable precise communication during incident response.

| ID | Name | Description |
|---|---|---|
| IL-001 | THE_STALE_CACHE | A caching layer is serving data that is significantly older than operators believe, because cache invalidation has silently stopped |
| IL-002 | THE_QUEUE_THEATER | Operations are being accepted and queued but the queue processor has stopped; the queue grows silently |
| IL-003 | THE_BLIND_WATCHDOG | The health monitoring system's checks have stopped running; it reports the last known state indefinitely |
| IL-004 | THE_GHOST_REPLICA | A replica that is supposed to be receiving replication has silently stopped receiving it; reads from the replica return increasingly stale data |
| IL-005 | THE_SILENT_DRAIN | The corpus ingestion pipeline has stalled; events continue to be generated but are not reaching the corpus |
| IL-006 | THE_PARTIAL_CONSENSUS | A consensus mechanism is functioning for most participants but one participant has diverged; decisions appear unanimous but are not |
| IL-007 | THE_DEAD_LETTER_FLOOD | Dead letter queue is filling silently; the queue's growth has no visible operational impact until it causes storage exhaustion |
| IL-008 | THE_METRIC_ECHO | A metrics aggregation system is repeating the last successfully reported metric; the underlying component has stopped reporting |
| IL-009 | THE_CONFIDENT_UNCERTAINTY | A health check that should return UNKNOWN is returning a stale NOMINAL because its error handling defaults to the last known good state |
| IL-010 | THE_RECOVERY_ILLUSION | A component that was in CRITICAL state has returned to NOMINAL reporting without actually recovering; the CRITICAL condition is masked |

---

## 18. Confidence Downgrade Rules

Confidence is downgraded (from higher to lower classification) under the following conditions. Downgrades are automatic and immediate; upgrades require evidence of recovery:

| Trigger | Downgrade |
|---|---|
| Any health check more than 2 minutes old | HIGH → MEDIUM |
| Any dependency in WARNING | FULL → HIGH |
| Any dependency in CRITICAL | HIGH or above → LOW |
| Corpus ingestion lag >2 seconds | Two levels down |
| Connectivity state non-NOMINAL | One level down per step from NOMINAL |
| PRE determinism verification not run within 72 hours | HIGH → MEDIUM |
| Dead letter queue >10% capacity | HIGH → MEDIUM |
| Any infrastructure illusion failure detection | Immediate → LOW |
| UNKNOWN health dimension | One level down |

Confidence may not be upgraded automatically. Upgrade requires:
- The triggering condition has been resolved
- A verification check confirms resolution
- The resolution is logged in the corpus

---

## 19. Escalation Triggers

The following conditions trigger escalation to the next authority tier regardless of whether an explicit incident has been declared:

**Immediate escalation (Tier 3 within 5 minutes):**
- Confidence score reaches UNKNOWN
- Corpus ingestion has stalled for >5 minutes
- Any infrastructure illusion failure detected
- Split-brain alert (see MULTI-REGION-OPERATIONAL-CONSISTENCY-v1.md §6.3)
- Buffer capacity at CRITICAL

**Scheduled escalation (Tier 3 review within 1 hour):**
- Any dependency at CRITICAL for >15 minutes
- Confidence score at LOW for >30 minutes
- Reconnection sequence stalled
- Dead letter queue >50% capacity

**Advisory notification (operational awareness, no immediate action required):**
- Any dependency entering WARNING
- Confidence score drops from FULL to HIGH
- Replication lag exceeds freshness threshold
- Any health check older than its expected interval
