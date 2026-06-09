# Replay Intelligence and Forensics
## Operational Evidence Infrastructure for Incident Analysis, Drift Detection, and Institutional Memory
### Version 1 — Phase J, Operator Simulation and Replay Intelligence Era

---

## 1. Purpose and Governing Principle

Replay is the authoritative record of what happened in the ClubHub TV system.

This document treats replay not as a playback utility but as an operational evidence infrastructure — the foundational substrate from which incidents are understood, divergences are diagnosed, behaviors are validated, and institutional knowledge is accumulated across time.

The governing principle:

> **Replay is the institutional witness. It cannot be altered, coerced, or silenced. It can only be examined and annotated.**

Every commitment made in this document flows from that principle. The replay corpus is not merely useful — it is the ground truth against which all other operational claims are measured.

---

## 2. Replay Evidence Hierarchy

Not all replay artifacts carry equal evidential weight. The hierarchy below governs which artifacts may be cited as authoritative in incident analysis, certification decisions, and drift investigations.

### Tier 1 — Corpus Replay Packets (Highest Authority)

- Hash-chained packets stored in the primary corpus
- Content-addressed: packet ID is derived from packet hash
- Every packet carries: event sequence, state transitions, operator actions, governance decisions, timestamps
- Tier 1 packets may not be modified, redacted, or deleted without explicit governance escalation

### Tier 2 — Verified Secondary Records

- Database snapshots created by the governed snapshot process
- State hash records from the hash chain store
- Audit log entries that are hash-linked to corpus packets
- These corroborate Tier 1 but do not supersede it. Where Tier 2 contradicts Tier 1, Tier 1 prevails and the discrepancy triggers an investigation.

### Tier 3 — Operational Log Streams

- Structured log output from operational services
- Telemetry and observability pipeline outputs
- Operator console action logs
- These are informative but not authoritative. They are subject to buffering, sampling, and pipeline loss. They contextualize Tier 1; they cannot replace it.

### Tier 4 — Human Reports and Annotations

- Incident reports filed by operators
- Session notes from instructors
- Post-incident analysis documents
- Human-authored and therefore subject to recall limitations, perspective bias, and time delay. These inform but cannot override Tier 1 evidence.

### Evidence Conflict Resolution

When evidence tiers conflict:
1. Tier 1 is presumed correct.
2. Tier 2 discrepancies trigger a hash chain audit to determine if Tier 1 has been corrupted or if Tier 2 is incorrect.
3. Tier 3 discrepancies trigger a log pipeline audit.
4. Tier 4 discrepancies are documented as human-record conflicts and resolved via Tier 1 examination.

---

## 3. Temporal Reconstruction Guarantees

### 3.1 The Reconstruction Commitment

The system commits to the following reconstruction guarantees:

**G1 — Completeness:** Every event that affected governance state is captured in the corpus. No governance-affecting event may occur outside the replay-tracked surface.

**G2 — Ordering:** Events are ordered by a monotonic clock that is consistent across all system components. The ordering in the corpus is the authoritative ordering. There is no "simultaneously" in the corpus — concurrent events are serialized by the governed consensus mechanism.

**G3 — Causal Integrity:** The corpus records sufficient information to determine which events caused which subsequent state changes. It is not merely an event log; it is a causal graph.

**G4 — Temporal Precision:** Timestamps are stored at millisecond resolution and are traceable to the system's governed clock source. Clock skew between components is bounded and logged.

**G5 — Anchor Stability:** State snapshots at declared intervals allow reconstruction to begin from any anchor point without replaying the entire history from genesis.

### 3.2 Reconstruction Failure Modes

These failures indicate corpus integrity compromise:

| Failure | Description | Response |
|---|---|---|
| HASH_CHAIN_BREAK | A packet's hash does not match the expected value in the chain | Quarantine all packets after break, trigger forensic investigation |
| MISSING_EVENT | A state transition exists with no corresponding event | Corpus gap investigation, potential reconstruction from Tier 2 |
| ORDERING_VIOLATION | Event timestamp precedes the prior event in the chain | Clock skew investigation, potential replay window corruption |
| ORPHANED_STATE | A state snapshot exists with no traceable event path | State origin investigation |
| DUPLICATE_SEQUENCE | Identical event sequences at different timestamps | Replay pipeline deduplication audit |

### 3.3 Recovery Ordering

When corpus integrity is compromised:
1. All replay-dependent operations halt immediately.
2. The last verified anchor point is identified.
3. Tier 2 records are used to reconstruct the gap where possible.
4. Reconstructed gaps are marked RECONSTRUCTED in the corpus, not presented as original records.
5. The reconstruction provenance is permanently logged alongside the gap.

---

## 4. Multi-Stream Replay Synchronization

### 4.1 Stream Sources

A complete operational record typically spans multiple streams:
- **Governance stream** — kernel decisions, authority transitions, approval records
- **Operator action stream** — all operator inputs with context
- **Content stream** — schedule events, content delivery confirmations, manifest transitions
- **Device stream** — per-screen state changes, health signals, capability reports
- **Network stream** — connectivity events, bandwidth measurements, delivery latencies
- **Telemetry stream** — system performance metrics at governance-relevant resolution

### 4.2 Synchronization Requirements

For multi-stream replay to be valid:
- All streams must share the same clock reference
- Streams must be correlated by a common session or run ID
- Synchronization points (shared events that appear in multiple streams) must be verified to appear at consistent timestamps across streams

### 4.3 Synchronization Failure

When stream synchronization cannot be established:
- Each stream is still valid as a partial record
- Cross-stream claims (e.g., "the governance decision caused the device failure") require explicit synchronization evidence
- Unverified cross-stream claims are annotated as UNVERIFIED_CAUSAL_CLAIM

### 4.4 Stream Join Protocol

The replay engine produces a synchronized multi-stream view by:
1. Selecting all streams for the incident window
2. Aligning on shared synchronization events
3. Producing a merged timeline where each event is tagged with its source stream
4. Flagging any gaps where a stream has no events during a period when other streams do (potential data loss)

---

## 5. Operator Action Reconstruction

### 5.1 What is Reconstructed

For every operator action in the corpus, the replay engine can reconstruct:
- **The action taken** — what the operator did (command, click, escalation)
- **The information surface presented** — what the operator saw at the time of action
- **The system state at action time** — what was true in the system when the operator decided
- **The preceding context** — events in the N minutes before the action
- **The outcome** — what changed in system state as a direct result of the action

### 5.2 Information Surface Reconstruction

This is the most forensically important aspect of operator action reconstruction.

A operator's decision is only intelligible in the context of what information was available to them. Reconstructing "what the operator did" without reconstructing "what the operator knew" produces an incomplete and potentially unfair record.

The replay engine reconstructs the operator's information surface by:
- Identifying the operator role and its declared information access at the time
- Replaying the UI state surface that would have been visible given the system state
- Identifying any information that was present in the system but not surfaced to the operator's role

This reconstruction is used in incident analysis to distinguish:
- **Operator error given correct information** (the information was available and the action was still incorrect)
- **Operator action given incomplete information** (the information was not surfaced; the action was reasonable given what was visible)
- **System information failure** (the information existed but was incorrectly surfaced or was absent due to system failure)

### 5.3 Reconstruction Limitations

Operator action reconstruction cannot reconstruct:
- What the operator was thinking
- Whether the operator noticed information that was surfaced
- Physical environment factors (distraction, fatigue)
- Actions taken outside the monitored console surface

These limitations must be declared when operator action reconstruction is used in any consequential review.

---

## 6. Causality Extraction Model

### 6.1 Causal Chain Construction

The replay engine supports causal chain extraction: given an outcome event, identify the sequence of events that causally contributed to it.

**Direct cause:** The immediately preceding state change that produced the outcome.

**Contributing causes:** State changes earlier in the sequence that set up the conditions for the direct cause to occur.

**Enabling conditions:** Persistent states that made the outcome possible without being direct events in the sequence.

**Precipitating events:** The specific event that triggered the causal chain from enabling conditions to actual outcome.

### 6.2 Causal Chain Notation

Causal chains are expressed in the replay forensics notation:

```
OUTCOME: [event]
  ← DIRECT_CAUSE: [event] at [tick]
      ← CONTRIBUTING: [event] at [tick]
      ← CONTRIBUTING: [event] at [tick]
          ← ENABLING: [persistent state] since [tick]
  ← PRECIPITATING: [event] at [tick]
```

### 6.3 Causal Ambiguity

When the replay evidence does not uniquely determine causality:
- Multiple causal hypotheses are stated explicitly
- Each hypothesis is marked with its supporting evidence
- The most parsimonious hypothesis is presented first
- Conclusions requiring causal claims must cite the supporting causal chain

Causal conclusions may not be stated as certain when replay evidence supports only probabilistic attribution.

### 6.4 Counterfactual Causality

The replay forensics infrastructure supports counterfactual causal reasoning:
"If event X had not occurred, would outcome Y have still occurred?"

This is evaluated by:
1. Identifying the state at the moment of event X
2. Constructing a simulation that replays from that state without event X
3. Observing whether outcome Y occurs in the counterfactual simulation
4. Reporting the counterfactual result with its simulation ID (for traceability)

Counterfactual causal claims always cite their simulation ID. Claims not backed by a simulation are explicitly speculative.

---

## 7. Replay Indexing Architecture

### 7.1 Index Dimensions

The replay corpus is indexed across multiple dimensions to support rapid forensic retrieval:

**Temporal index:** Retrieve packets by time window.

**Venue/device index:** Retrieve packets by which venue, device cluster, or individual device is involved.

**Event type index:** Retrieve packets containing specific event types (e.g., all packets containing a GOVERNANCE_ESCALATION event).

**Operator index:** Retrieve packets containing actions by a specific operator role or operator ID (subject to privacy governance in §13).

**Severity index:** Retrieve packets classified at or above a declared severity level.

**Causal index:** Retrieve packets that are causally upstream or downstream of a declared packet.

**Outcome index:** Retrieve packets that ended in a declared outcome state.

### 7.2 Index Integrity

Index entries are derived from corpus content at indexing time. Indexes are not authoritative — the packet is authoritative. Index drift (where the index and the packet disagree) triggers an index rebuild.

### 7.3 Query Governance

Replay index queries that touch operator action records require:
- Declared query purpose
- Declared requesting authority
- Logged query with timestamp and result set size
- Retention of query log for audit purposes

---

## 8. Incident Forensics Workflow

### 8.1 Incident Forensics Trigger

A forensic investigation is triggered by:
- Declared operational incident (severity HIGH or above)
- Automated anomaly detection crossing a declared threshold
- Operator request following an unexpected outcome
- Certification review following a simulation failure
- Scheduled post-incident review (all incidents within 7 days)

### 8.2 Forensics Workflow Stages

**Stage 1 — Incident Window Declaration**
Define the time window and scope of the incident. Identify the outcome event that defines the end of the incident.

**Stage 2 — Evidence Gathering**
Retrieve all Tier 1, 2, and 3 evidence for the incident window. Verify hash chain integrity across the window. Identify any gaps.

**Stage 3 — Timeline Construction**
Produce the synchronized multi-stream timeline for the incident window. Identify all operator actions, governance decisions, and system events.

**Stage 4 — Causal Chain Extraction**
Apply the causality extraction model to identify the causal path from precipitating event to outcome.

**Stage 5 — Information Surface Reconstruction**
For each operator action in the timeline, reconstruct the information surface available to the operator.

**Stage 6 — Counterfactual Analysis (Optional)**
For selected decision points, execute counterfactual simulations to evaluate alternative paths.

**Stage 7 — Finding Documentation**
Document findings using the declared finding format. Classify findings by category (see below). Assign follow-up responsibilities.

**Stage 8 — Corpus Annotation**
Annotate the relevant corpus packets with the investigation ID and finding summary. Annotations are additive; packets are not modified.

### 8.3 Finding Categories

| Category | Description |
|---|---|
| OPERATOR_ERROR_KNOWN_INFO | Operator action was incorrect given information that was correctly surfaced |
| OPERATOR_ACTION_INFORMATION_GAP | Operator action was reasonable given surfaced information, but system held additional relevant information not surfaced |
| SYSTEM_INFORMATION_FAILURE | Incorrect or missing information was surfaced due to system failure |
| GOVERNANCE_DECISION_ERROR | The governance kernel made an incorrect decision given correct inputs |
| CONFIGURATION_DRIFT | Venue or device configuration had drifted from declared state |
| EXTERNAL_DEPENDENCY_FAILURE | An external dependency (network, content, hardware) produced the failure |
| SCENARIO_OUTSIDE_CORPUS | The event pattern had no corpus precedent; the system had not been trained on this condition |
| HUMAN_PROCESS_GAP | A gap in operational procedures enabled the failure |

---

## 9. Divergence Archaeology

### 9.1 Purpose

Divergence archaeology is the investigation of cases where a system replay produces different output than a previous execution from the same initial state.

Divergence in a deterministic system indicates:
- A change in the system's code or configuration between executions
- A change in an external dependency's behavior
- Corpus corruption
- A latent non-determinism bug

### 9.2 Divergence Classification

**INTENTIONAL_DIVERGENCE:** A declared system change (code deployment, configuration update) produced the divergence. Expected and documented.

**CONFIGURATION_DRIFT_DIVERGENCE:** An undeclared configuration change in a dependency produced the divergence. Represents a governance gap.

**CORPUS_CORRUPTION_DIVERGENCE:** The corpus packet has changed since the original execution. Represents an integrity violation.

**LATENT_NONDETERMINISM:** The system produces different output from identical inputs. Represents a determinism bug requiring code investigation.

**EXTERNAL_DEPENDENCY_DIVERGENCE:** An external system (content delivery, network) behaved differently between executions. Not a bug but may indicate unreliable dependencies.

### 9.3 Divergence Investigation Protocol

1. Identify the first point of divergence in the event sequence.
2. Compare the system state at divergence point across both executions.
3. Identify what input or condition differed between executions at that point.
4. Trace the differing input to its source.
5. Classify the divergence.
6. Document findings and follow-up.

---

## 10. Replay Annotation Governance

### 10.1 Annotations are Additive Only

Corpus packets are immutable. Annotations are the mechanism for adding context, findings, and corrections to the record without altering the original.

Each annotation contains:
- Target packet ID (or range of packet IDs)
- Annotation type
- Author (role and identity)
- Timestamp
- Content
- Annotation ID (used to reference this annotation in subsequent analysis)

### 10.2 Annotation Types

| Type | Description | Authority Required |
|---|---|---|
| FORENSIC_FINDING | Investigation finding attached to packets in the incident window | Forensics authority |
| CAUSAL_ANNOTATION | Identified causal relationship between events in different packets | Forensics authority |
| CONTEXT_NOTE | Background information explaining why a sequence occurred | Operations authority |
| CORRECTION_NOTICE | Documents that a human record (Tier 4) was incorrect; the corpus record is correct | Governance authority |
| PRIVACY_REDACTION_NOTICE | Documents that a privacy redaction was applied and its scope | Platform authority |
| SIMULATION_REFERENCE | Links a corpus packet to a simulation session that used it as an anchor | Simulation authority |
| CERTIFICATION_REFERENCE | Links a corpus packet to a certification examination that used it | Certification authority |

### 10.3 Annotation Integrity

Annotations are themselves hash-linked. The annotation chain is verifiable independently of the corpus hash chain. An annotation that references a non-existent packet ID is invalid.

---

## 11. Counterfactual Comparison Model

### 11.1 Purpose

Counterfactual comparison is the structured comparison of what happened against what would have happened under different conditions.

This is used for:
- Post-incident learning ("what if the operator had responded differently")
- Certification design ("what is the correct path through this scenario")
- Drift analysis ("what would have happened with the previous system version")

### 11.2 Comparison Protocol

A counterfactual comparison produces:
- **Observed path** — the actual sequence from the corpus
- **Counterfactual path** — the simulation of the alternative
- **Divergence map** — a structured comparison of the two paths, event by event
- **Outcome differential** — the difference in outcome state between the two paths
- **Decision impact score** — for each point where the paths diverge, an assessment of how much impact the divergence had on the outcome

### 11.3 Counterfactual Governance

Counterfactuals are simulation products. They are:
- Labeled COUNTERFACTUAL in all artifacts
- Not presented as what "would have happened" without the simulation ID for traceability
- Not used to retroactively assign blame based on what "should have been obvious"

The counterfactual record exists to learn from. It does not constitute a factual record of events.

---

## 12. Drift Detection via Replay Comparison

### 12.1 Behavioral Drift

The system may drift in behavior between deployments in ways that are not captured by unit tests. Replay-based drift detection runs prior scenarios against the current system and compares outputs.

### 12.2 Drift Detection Protocol

1. Select a sample of corpus packets from the prior 30 days
2. Re-execute each packet against the current system
3. Compare outputs event by event
4. Flag any output differences
5. Classify differences as INTENTIONAL (covered by a declared change), ACCEPTABLE (within declared tolerance), or DRIFT (unexplained behavioral change)

### 12.3 Drift Tolerance Declarations

Not all behavioral differences are failures. Some differences are expected (timing improvements, log format changes). Acceptable differences must be declared in a tolerance manifest:

```yaml
drift_tolerance:
  - event_type: LOG_ENTRY
    fields_excluded: [timestamp, request_id]
    reason: Non-deterministic identifiers
  - event_type: TELEMETRY_METRIC
    numeric_tolerance: 0.001
    reason: Float arithmetic precision variation
```

Any difference not covered by the tolerance manifest is flagged for review.

### 12.4 Governance Drift vs. Behavioral Drift

**Behavioral drift** is a change in system output given the same inputs. This is detectable via replay comparison.

**Governance drift** is a change in how governance decisions are made — drift in the interpretation of authority boundaries, severity classifications, or escalation thresholds. This requires audit comparison, not just replay comparison.

Both forms of drift must be tracked. Governance drift is the more dangerous form because it may produce correct-looking outputs from an incorrect decision process.

---

## 13. Replay Trust Scoring

### 13.1 Purpose

Not all corpus packets have equal confidence. Trust scoring provides a structured assessment of how much confidence can be placed in a specific packet.

### 13.2 Trust Score Dimensions

| Dimension | Description |
|---|---|
| HASH_CHAIN_VERIFIED | Packet hash verified within the chain |
| SYNCHRONIZATION_VERIFIED | Multi-stream synchronization confirmed for this packet's window |
| ANCHOR_STABILITY | Packet is within a stable region (no surrounding chain breaks) |
| OPERATOR_ACTION_COMPLETENESS | All declared operator actions for the session are present |
| EXTERNAL_DEPENDENCY_CORROBORATION | External dependency behavior corroborated by independent record |
| REPLAY_DETERMINISM_VERIFIED | Packet has been replayed and produces identical output |

Trust score is expressed as a fraction of dimensions verified. A packet scoring below 0.7 may not be used as a primary Tier 1 evidence source without explicit governance approval.

### 13.3 Trust Score Use

Trust scores are informational. They guide evidential weight. They do not automatically disqualify a packet from use in an investigation — a low-trust packet with partial evidence may still be better than no evidence. But the trust score must be declared when the packet is cited.

---

## 14. Long-Horizon Behavioral Analysis

### 14.1 Purpose

Individual incidents are understood through their immediate causal chains. But patterns of incidents, recurring failure modes, and slow drift require analysis across time scales of weeks, months, and quarters.

Long-horizon behavioral analysis uses the corpus as the data source for operational trend extraction.

### 14.2 Analysis Dimensions

**Failure mode frequency:** How often does each failure mode classification appear? Is frequency increasing, decreasing, or stable?

**Response quality trends:** Across incidents of similar severity, is operator response time improving? Is resolution quality improving?

**Drift magnitude trends:** Are divergence rates in replay comparison increasing? This indicates increasing behavioral drift.

**Configuration stability:** How often is venue or device configuration found to have drifted from declared state?

**Corpus coverage trends:** Is the corpus gaining coverage of new event types, or are there regions of operation with no corpus representation?

### 14.3 Governance Requirements for Trend Analysis

Long-horizon analysis crosses many incident records and many operator records. These governance requirements apply:

- Trend analysis uses aggregate data; it does not single out individual operators
- Any finding that implicates a specific individual requires Tier 1 evidence support and forensic review process
- Trend reports are reviewed by governance authority before publication
- Trend data is retained for the full corpus retention period

---

## 15. Replay Redaction Governance

### 15.1 Redaction Principles

Replay redaction is the removal or obscuring of specific content from corpus packets. It is a last resort, used only when:
- Legal order requires removal of specific data
- Privacy protection requires removal of personally identifiable information not relevant to operational analysis
- Security review determines specific technical content must be protected

Redaction is never applied to make an operational record more favorable to any party.

### 15.2 Redaction Protocol

1. Redaction request is filed with declared basis (legal, privacy, security)
2. Governance authority reviews the request
3. If approved, the redaction is applied with a REDACTION_NOTICE annotation
4. The annotation records: what was redacted, the basis, the approving authority, and the timestamp
5. The original packet is archived in a separately governed store (not deleted) accessible only to governance authority
6. The redacted packet in the main corpus carries a permanent marker indicating redaction

### 15.3 What May Never Be Redacted

The following may never be redacted from corpus packets under any circumstance:
- Event sequence structure and ordering
- State transition records
- Governance decision records
- The existence of operator actions (the content may be redacted, but the fact that an operator acted may not be)
- Hash chain linkages

Redaction of these elements would undermine the corpus's function as an institutional witness.

---

## 16. Replay as Institutional Witness

The replay corpus is the ClubHub TV operational record. It is not a log file. It is not a debugging tool. It is the institutional memory of what happened, when, in what order, and why.

This carries obligations:

**For the system:** Every governance-relevant event must be recorded in the corpus. There is no acceptable silent failure mode. A system that makes governance decisions without recording them is operating outside constitutional bounds.

**For operators:** The corpus records what happened, not what operators wish had happened. Operators do not have access to corpus editing. The corpus is not an adversary — it is the shared record that protects everyone from misremembering.

**For investigators:** The corpus is examined, not edited. Investigators annotate their findings; they do not alter the record. Findings that contradict the corpus are investigated further; they do not displace the corpus.

**For the institution:** Long after the people who made specific decisions have moved on, the corpus remains. It is the institutional continuity mechanism. The operational knowledge of what the system does and what operators did under real conditions is stored in the corpus.

This is why replay is deterministic, hash-chained, and protected from modification. Its value is proportional to its trustworthiness. A corpus that can be altered is not a witness — it is a liability.

---

## 17. Constitutional Restrictions on Replay Editing

The following are absolutely and permanently prohibited:

1. **Modifying the content of a Tier 1 corpus packet that has been committed to the chain.** Once a packet is in the chain, its content is fixed. The chain can only be extended, not modified.

2. **Deleting a corpus packet without governance authorization.** Deletion without documented authorization is treated as corpus tampering.

3. **Altering the timestamp of a committed packet.** Temporal ordering is the foundation of causality analysis.

4. **Producing a modified copy of a corpus packet and presenting it as original.** This is falsification of the operational record.

5. **Redacting the existence of an event.** Redaction may obscure content; it may not make an event disappear from the timeline.

6. **Using replay editing as a mechanism to protect any party from accountability.** The corpus is not subject to political or institutional pressure.

7. **Retroactively classifying a packet as out-of-scope for an investigation** after the investigation has begun.

---

## 18. Named Replay Corruption Failure Modes

| ID | Name | Description | Detection | Response |
|---|---|---|---|---|
| RC-001 | SILENT_WRITE | An event occurred and affected state but was not recorded | State discrepancy between replay and live | Gap investigation |
| RC-002 | PHANTOM_EVENT | An event appears in the corpus with no corresponding state change | Replay-state comparison | Audit log cross-check |
| RC-003 | HASH_MISMATCH | Packet hash does not match stored value | Hash chain verification | Quarantine and forensic investigation |
| RC-004 | TIMESTAMP_INVERSION | An event is timestamped before its causal predecessor | Chain traversal | Clock skew investigation |
| RC-005 | STREAM_DESYNC | Multi-stream packets for the same session cannot be synchronized | Synchronization protocol | Stream-by-stream individual analysis |
| RC-006 | DUPLICATE_PACKET | Identical packet content at different chain positions | Deduplication scan | Duplicate removal with provenance investigation |
| RC-007 | ANCHOR_ORPHAN | A snapshot anchor references a state that cannot be reached from genesis | Anchor verification | Reconstruction from Tier 2 |
| RC-008 | REDACTION_WITHOUT_NOTICE | Packet content is absent without a REDACTION_NOTICE annotation | Completeness scan | Retroactive annotation or corpus integrity investigation |
| RC-009 | FOREIGN_WRITE | A packet was inserted into the chain by a process outside the governed write path | Chain authority audit | Full chain re-verification |
| RC-010 | ANNOTATION_ORPHAN | An annotation references a packet ID that does not exist | Annotation integrity scan | Annotation quarantine |

---

## 19. Replay Evidence Chain Requirements

For a replay evidence chain to be admissible in any consequential review (incident finding, certification decision, governance audit):

1. Hash chain verified for all packets in the evidence window
2. Trust score declared for each primary evidence packet
3. Multi-stream synchronization verified or gaps declared
4. All Tier 4 claims cross-referenced against Tier 1 evidence
5. Causal chain constructed and peer-reviewed by a second forensics authority
6. Counterfactual simulations cited by simulation ID if used in causal conclusions
7. Evidence redactions declared with basis and scope
8. Final evidence chain signed by the forensics authority responsible for the investigation

---

## 20. Replay Certification Requirements

The replay infrastructure must be certified annually by an independent governance review:

**Certification checks:**
- Hash chain integrity scan across the full corpus
- Determinism verification: random sample of 50 packets re-executed; all must produce identical output
- Multi-stream synchronization integrity: random sample of 10 incident windows; all must synchronize correctly
- Index integrity: all indexes verified against corpus content
- Trust score calibration: trust scores for a random sample compared against manual assessment
- Redaction governance: all redactions reviewed for basis, scope, and REDACTION_NOTICE compliance
- Recovery procedure test: a controlled hash chain break is introduced and the recovery procedure is exercised

Certification report is stored as a Tier 2 record and referenced from the corpus governance register.
