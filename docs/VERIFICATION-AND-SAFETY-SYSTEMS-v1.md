# VERIFICATION-AND-SAFETY-SYSTEMS-v1.md
# ClubHub TV — Verification, Simulation, Observability, and Operational Safety Architecture

**Document type:** Canonical governance specification — permanent verification authority layer
**Status:** Ratified
**Date:** 2026-05-20
**Authority:** Implements and extends ENGINEERING-CONSTITUTION-v1.md §15, §25, §28; coordinates with PRE-REFERENCE-IMPLEMENTATION-v1.md, IMPLEMENTATION-ROADMAP-v1.md, and OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
**Superseded by:** Constitutional amendment only (per ENGINEERING-CONSTITUTION-v1.md §30)

---

## Normative Language

The key words in this document carry the following precise meanings, identical to those defined in ENGINEERING-CONSTITUTION-v1.md §0:

- **MUST** — Absolute requirement. Violation is a defect. No exceptions without constitutional amendment.
- **MUST NOT** — Absolute prohibition. Any system exhibiting this behavior is non-conformant.
- **SHOULD** — Strong recommendation. Deviation requires explicit documented justification.
- **SHALL** — Synonym for MUST.
- **MAY** — Permitted. Not required. No justification needed to omit.

Where this document conflicts with ENGINEERING-CONSTITUTION-v1.md on matters of principle, the Constitution takes precedence. Where this document conflicts with PRE-REFERENCE-IMPLEMENTATION-v1.md on matters of PRE behavioral semantics, the PRE specification takes precedence. This document governs all aspects of how the system verifies, observes, and proves its own correctness over time.

---

## Table of Contents

1. [Verification Philosophy](#1-verification-philosophy)
2. [Verification Pyramid](#2-verification-pyramid)
3. [PRE Deterministic Replay System](#3-pre-deterministic-replay-system)
4. [Property-Based Verification](#4-property-based-verification)
5. [Manifest Equivalence Verification](#5-manifest-equivalence-verification)
6. [Chaos Verification Architecture](#6-chaos-verification-architecture)
7. [Operational Entropy Detection](#7-operational-entropy-detection)
8. [Preview and Explainability Systems](#8-preview-and-explainability-systems)
9. [Observability Architecture](#9-observability-architecture)
10. [Constitutional Enforcement](#10-constitutional-enforcement)
11. [Human Factors Safety](#11-human-factors-safety)
12. [Long-Term Drift Prevention](#12-long-term-drift-prevention)
13. [Failure Philosophy](#13-failure-philosophy)
14. [Replay Corpus Governance](#14-replay-corpus-governance)
15. [Future Extraction Safety](#15-future-extraction-safety)
16. [Appendix: Verification Matrix](#16-appendix-verification-matrix)
17. [Appendix: Severity Classification Matrix](#17-appendix-severity-classification-matrix)

---

## 1. Verification Philosophy

### 1.1 The Foundational Claim

The ClubHub TV platform makes an auditable promise to venue operators: at any past, present, or future moment, the system can show exactly what was, is, or will be playing on every screen, and explain precisely why. This promise is not a product feature. It is the load-bearing foundation on which proof-of-play obligations, operator trust, sponsorship contracts, and emergency compliance all rest.

Verification is the ongoing practice of proving that this promise holds. It is not a test phase that ends at launch. It is not a CI gate that fires on pull requests. It is a permanent architectural commitment — a set of systems, invariants, and review cadences that operate continuously and grow more comprehensive over time.

This section defines the philosophical commitments that govern all verification decisions on this platform. These commitments are constitutional. They may not be suspended for operational convenience or schedule pressure.

### 1.2 Correctness Over Availability

The platform MUST prioritize correctness of output over continuity of service. Serving a stale manifest with explicit degradation indicators is preferable to serving an incorrect manifest with high confidence. Serving the System Fallback is preferable to serving a manifest that cannot be verified against current system state.

This is not a theoretical preference. It has concrete enforcement consequences:

- The System Fallback (defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §17.3) MUST be compiled into the application binary and available without any database, cache, or network dependency.
- Any manifest served from a stale cache MUST carry explicit indicators in its metadata and structured log.
- Any manifest served when PRE computation fails MUST be identifiable as a degraded response, not a current one.

The phrase "we served something" is never sufficient. The phrase "we can prove what we served and why" is the minimum bar.

### 1.3 Deterministic Replayability

For any screen at any point in time within the audit retention window, given the `SystemState` committed at that timestamp — recoverable from the append-only audit log — a replay of `PRE.resolve(screen_id, at, audit_log)` MUST produce output bit-identical to the output produced when that invocation originally ran.

This is not a debugging convenience. It is the mechanism by which:

- Proof-of-play claims are grounded (claims are only as strong as the ability to replay them)
- Emergency override compliance is verified
- Sponsorship delivery is audited
- Incident investigations reconstruct past platform behavior

Deterministic replayability constrains the PRE function signature permanently: the function accepts `screen_id`, a timestamp in UTC milliseconds, and a database connection read-transaction. No other inputs may influence its output. Process environment, wall-clock reads, random number generators, external network calls, and all forms of implicit state are forbidden within PRE (see INV-1, INV-3 in ENGINEERING-CONSTITUTION-v1.md §3).

### 1.4 Explainability Over Heuristics

Every output produced by PRE MUST be explainable to a human operator without access to source code. The `reason_trace` field of every `PRE_Output` (defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §3.2) MUST be sufficient — in isolation — for an operator to reconstruct exactly why each item is present in the active playlist.

Explainability is not a user-experience aspiration. It is a constitutional requirement (ENGINEERING-CONSTITUTION-v1.md §21.1). Optimization that reduces explainability is prohibited (ENGINEERING-CONSTITUTION-v1.md §2.2). Heuristics whose rationale cannot be expressed in a `reason_trace` entry MUST NOT be introduced into the resolution path.

### 1.5 No Hidden Mutations

The PRE function is a pure function. It MUST NOT produce any observable external effect during its execution (INV-1). It MUST NOT write to any persistent store, emit events, update counters, modify cache, or perform any network calls. The sole outputs of PRE are the `PRE_Output` value it returns and the structured log lines emitted by the Manifest Delivery System that invokes it.

Automatic corrective behavior — any system action that modifies operator-configured state without operator initiation — is categorically forbidden (ENGINEERING-CONSTITUTION-v1.md §13.1, FP-06). This prohibition applies permanently. No entropy signal, confidence score, divergence classification, or operational metric MAY trigger automatic modification of scheduling, override, emergency, or sponsorship configuration.

### 1.6 Entropy Is Observable, Not Auto-Corrected

The platform's operational entropy detection system (defined in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md and summarized in Section 7 of this document) surfaces indicators of configuration drift to operators. These indicators are advisory instruments. They direct operator attention. They never initiate corrective action.

The system cannot infer operator intent from observed configuration state. High override divergence may indicate drift or may reflect intentional venue customization. Low campaign coverage may indicate fragmentation or may reflect a deliberate scheduling philosophy. The operator holds the context the system lacks. The system's role is to make the relevant signals visible so the operator can exercise informed judgment.

### 1.7 Every Operator-Visible State Must Be Reproducible

Any state that an operator can observe through a dashboard, API response, preview endpoint, or health report MUST be reproducible from immutable inputs available in the audit log and system configuration. There MUST be no operator-visible platform output that depends on ephemeral computation state, non-retained intermediate values, or undocumented internal behavior.

This principle ensures that on-call diagnosis, incident reconstruction, and compliance audits do not require access to proprietary tooling, live database state, or the specific application instance that produced the original output. All diagnostic information MUST be derivable from the audit log, structured logs, health endpoints, and the PRE Preview endpoint (ENGINEERING-CONSTITUTION-v1.md §12.5).

### 1.8 PRE Correctness Is Behavioral, Not Implementation-Specific

Correctness of the PRE is defined in terms of the invariants and behavioral specification in PRE-REFERENCE-IMPLEMENTATION-v1.md. A conforming implementation is one that produces identical `PRE_Output` for identical `(screen_id, at, SystemState)` inputs. The specific language, runtime, data structure choices, and internal algorithmic approach are not part of the correctness definition.

This separation has a direct verification consequence: all verification systems — replay harnesses, property testers, shadow-mode comparators, chaos test suites — operate against PRE as a black box whose input-output behavior is the specification. An implementation that passes all behavioral verification is correct by definition, regardless of its internals. An implementation that fails any behavioral invariant is incorrect regardless of its internal elegance.

All simulation systems operate against PRE as a pure function. They provide inputs. They observe outputs. They verify invariants. They never inspect PRE's internal state.

---

## 2. Verification Pyramid

### 2.1 Overview

The ClubHub TV verification system is organized as a layered pyramid. Lower layers run more frequently, cover smaller scopes, and detect narrower categories of failure. Upper layers run less frequently, cover broader behavioral properties, and detect failure modes invisible to lower layers. No layer substitutes for any other.

```
                        [8] Production Invariant Monitoring
                      [7] Operational Entropy Verification
                    [6] Chaos Verification
                  [5] Shadow-Mode Parity Testing
                [4] Contract Enforcement
              [3] Deterministic Replay Testing
            [2] Property-Based Testing
          [1] Unit Verification
```

Each layer is described below with its precise scope, what it proves, and what failures it is permitted to block versus what failures it raises as advisories.

### 2.2 Layer 1: Unit Verification

**Scope:** Individual functions and algorithms within the PRE implementation, tested against deterministic pre-fixture `SystemState` inputs.

**What it proves:** That individual PRE sub-functions (SWRR algorithm, FNV-1a checksum, `scheduleActive` evaluation, DST boundary handling, suppression filter, confidence score computation) behave according to their specification for the inputs provided.

**Requirements:**
- PRE MUST have 100% branch coverage of the resolution algorithm (ENGINEERING-CONSTITUTION-v1.md §25.1).
- All PRE invariants INV-1 through INV-10 MUST have corresponding test cases in a separate invariant test file (§25.3).
- All tests MUST use committed, deterministic fixture inputs. No test MAY use live database state or randomly-generated fixtures (§25.2).
- Checksum test vectors from PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B MUST pass against every build.

**Deploy blocking:** Any unit test failure MUST block merge. Any reduction in branch coverage MUST block merge (§25.1). Any failure of Appendix B checksum vectors MUST block merge.

**Advisory only:** N/A at this layer. Failures are merge-blocking without exception.

### 2.3 Layer 2: Property-Based Testing

**Scope:** PRE behavioral invariants over generated input spaces, not just committed fixture inputs.

**What it proves:** That PRE invariants (INV-1 through INV-10) hold not only for known fixtures but across the full generative space of valid `SystemState` inputs, including edge cases that manual fixture construction would not produce.

**Requirements:** See Section 4 of this document for complete specification.

**Deploy blocking:** Any property test failure that demonstrates a PRE invariant violation MUST block merge. Property test failures from infrastructure issues (timeout, OOM) MAY be retried before blocking.

**Advisory only:** Property test failures where the test harness cannot shrink to a minimal reproducer within the configured time budget are logged as advisories and investigated before the next release cycle.

### 2.4 Layer 3: Deterministic Replay Testing

**Scope:** Exact reproduction of past PRE computations from captured `SystemState` snapshots and replay vectors.

**What it proves:** That the current implementation produces bit-identical output to the output produced by the implementation that originally ran against the same input. This is the mechanism by which implementation changes are verified not to alter PRE behavioral outputs.

**Requirements:** See Section 3 of this document for complete specification.

**Deploy blocking:** Any replay divergence MUST block merge. The phrase "the output changed intentionally" does not dissolve the block — it triggers a replay corpus update cycle (see Section 14) after which all replay tests must pass against updated expectations.

**Advisory only:** Replay tests that cannot execute due to corpus infrastructure failures are logged as advisories with a defined investigation SLA.

### 2.5 Layer 4: Contract Enforcement

**Scope:** Static analysis and runtime assertion checks that detect violations of constitutional forbidden patterns (FP-01 through FP-15) and schema invariants (FORBIDDEN-1 through FORBIDDEN-10).

**What it proves:** That no code in the resolution path violates the architectural prohibitions defined in the Engineering Constitution, and that no database state violates the invariants defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §23.

**Requirements:** See Section 10 of this document for complete specification.

**Deploy blocking:** Any contract enforcement failure MUST block merge. This includes: forbidden patterns detected in static analysis (`validate-contracts.js`), hardcoded threshold detection, PRE purity violations, and migration linting failures.

**Advisory only:** Contract violations in code paths explicitly marked as excluded (test utilities, migration scripts that predate enforcement) are surfaced as advisories during a defined grace period, after which they become blocking.

### 2.6 Layer 5: Shadow-Mode Parity Testing

**Scope:** Comparison of PRE outputs against the legacy manifest engine outputs over real production traffic, run during the Phase 2 shadow mode period defined in IMPLEMENTATION-ROADMAP-v1.md.

**What it proves:** That the PRE implementation produces semantically equivalent manifests to the legacy engine for the actual traffic mix present in the production environment, not only for constructed test inputs.

**Requirements:** See Section 5 of this document for complete specification.

**Deploy blocking:** Shadow parity below the defined confidence score threshold MUST block Phase 5 cutover. Specifically: zero-divergence rate over 24 hours is the Phase 2 gate (IMPLEMENTATION-ROADMAP-v1.md §Phase 2 gate). Divergences that are semantically tolerated (see Section 5.4) do not count against this rate.

**Advisory only:** Shadow-mode divergences that are classified as tolerated differences are logged as advisories, not failures.

### 2.7 Layer 6: Chaos Verification

**Scope:** Injection of infrastructure failure conditions (database unavailability, network partition, cache loss, clock skew, event bus lag) during integration test execution to verify that PRE invariants and graceful degradation behaviors hold under failure.

**What it proves:** That the system degrades gracefully under failure, that PRE invariants are preserved even when infrastructure dependencies fail, and that the System Fallback path activates correctly without requiring database access.

**Requirements:** See Section 6 of this document for complete specification.

**Deploy blocking:** Chaos test failures that demonstrate invariant violation under failure conditions MUST block merge. Chaos test failures that demonstrate unacceptable latency or resource behavior under failure MUST block deployment.

**Advisory only:** Chaos test failures that represent expected degradation within defined tolerance (e.g., stale cache served within MAX_STALE_AGE window) are logged as advisories.

### 2.8 Layer 7: Operational Entropy Verification

**Scope:** Continuous monitoring of the 12 entropy metrics (M-01 through M-12) defined in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, computed daily, surfaced to operators through dashboards, advisories, and operational review workflows.

**What it proves:** That the platform's current configuration state is within the operational health ranges expected for the venue's use patterns, and that drift toward problematic configuration patterns is detected early enough for operator review.

**Requirements:** See Section 7 of this document for complete specification.

**Deploy blocking:** Entropy metrics are advisory, never blocking. No entropy score, metric value, or staleness classification MUST NOT block deploys or operator actions (beyond the defined Tier 3 confirmation gate maximum).

**Advisory only:** All entropy signals are advisory. They direct operator attention and create audit records. They do not prevent action.

### 2.9 Layer 8: Production Invariant Monitoring

**Scope:** Continuous monitoring of constitutional invariants (INV-1 through INV-10) and forbidden state conditions (FORBIDDEN-1 through FORBIDDEN-10) in the running production system, separate from CI and pre-deploy testing.

**What it proves:** That invariants hold continuously in production, not only at the time of deployment. Configuration changes, data migrations, and time-dependent conditions (DST transitions, schedule expirations, contract rollovers) can cause invariant violations post-deploy.

**Requirements:** See Section 10 of this document for detailed monitoring queries. Violations MUST emit structured alerts that reach on-call within 60 seconds (ENGINEERING-CONSTITUTION-v1.md §28.4).

**Deploy blocking:** Production invariant monitor failures are P0 incidents. They do not gate deploys (which have already occurred) but trigger immediate incident response.

**Advisory only:** Near-threshold conditions that do not yet constitute invariant violations are surfaced as advisories through the entropy detection system.

### 2.10 Separation of Correctness Domains

The verification pyramid operates across three distinct correctness domains that MUST NOT be conflated:

**Engineering Correctness:** PRE produces bit-identical output for identical inputs. SWRR interleaving is exact. Checksums are deterministic. DST boundaries are handled per specification. All invariants INV-1 through INV-10 hold. Proven by Layers 1, 2, 3, 4.

**Operational Correctness:** The system gracefully degrades under failure. The System Fallback activates when required. Stale cache is served within tolerance windows. Emergency activation completes within 5 seconds. Proven by Layers 6, 7, 8.

**Semantic Correctness:** The configuration present in the system matches operator intent. Overrides are intentional. Campaigns are delivering to expected screens. Sponsorship share reflects contracted obligations. No entropy degradation pattern has advanced past operator awareness. Proven by Layers 5, 7.

Engineering correctness is necessary but not sufficient. A system can be engineered correctly — producing exactly the output the algorithm specifies — while being semantically incorrect because the configuration driving that algorithm no longer reflects what operators intend. All three domains require independent verification.

---

## 3. PRE Deterministic Replay System

### 3.1 Purpose and Constitutional Standing

The PRE Deterministic Replay System is constitutional infrastructure. It is not a testing convenience. It is the mechanism by which the platform's core replayability guarantee (ENGINEERING-CONSTITUTION-v1.md §15.1) is operationalized and continuously validated.

The guarantee: for any screen at any past timestamp within the 90-day queryable audit retention window, it MUST be possible to call `replayPRE(screen_id, at, audit_log)` and receive output identical to what `PRE.resolve()` produced when that invocation originally ran.

This guarantee must hold:
- After implementation changes to PRE
- After database schema migrations (within the invariant that no column in the PRE read set is dropped without a full release cycle)
- After dependency upgrades
- After service extraction events
- Indefinitely into the future for all captures within the retention window

### 3.2 Replay Packet Schema

Every PRE invocation that is designated for replay capture MUST produce a replay packet that serializes the complete input state consumed during that resolution. The replay packet is the immutable record from which future replay executions reconstruct SystemState.

```
TYPE ReplayPacket = {
  packet_id       : STRING (UUID v4),
  screen_id       : STRING,
  at              : INTEGER (UTC milliseconds),
  captured_at     : INTEGER (UTC milliseconds),
  capture_source  : ENUM ('production_sample', 'incident_capture', 'golden_vector', 'property_shrink'),
  pre_version     : STRING (semver of PRE implementation at capture time),
  system_state    : SystemStateSnapshot,
  expected_output : PRE_Output,
  output_checksum : STRING (FNV-1a 32-bit hex of canonical serialization of expected_output)
}

TYPE SystemStateSnapshot = {
  screen       : ScreenRecord,
  tv_group     : TvGroupRecord?,
  area         : AreaRecord?,
  venue        : VenueRecord,
  organization : OrganizationRecord,
  emergency    : EmergencyStateRecord?,
  overrides    : OverrideRecord[],
  schedules    : ScheduleRecord[],
  campaigns    : CampaignRecord[],
  sponsorships : SponsorshipContractRecord[],
  last_delivery: ScreenDeliveryLogRecord?
}
```

### 3.3 Canonical Serialization Rules

Replay packets MUST be serialized in canonical form to ensure stable comparison across implementations, language runtimes, and time:

1. All JSON objects have keys sorted lexicographically by Unicode code point (identical to `canonicalizeJson` defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §16.1).
2. All arrays are serialized in the order present in the data, not reordered.
3. All timestamps are expressed as UTC millisecond integers, never as formatted strings.
4. Null values are retained explicitly (not omitted as undefined).
5. No trailing whitespace or indentation.
6. UTF-8 encoding throughout.

The `output_checksum` field is computed as `fnv1a32(canonicalizeJson(expected_output))` where `fnv1a32` is the algorithm defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §18.1. This checksum allows bit-level verification of replay output without requiring full structural comparison.

### 3.4 Replay Determinism Guarantees

**Identical input MUST produce identical output. This guarantee is permanent and unconditional.**

Formally: for all valid replay packets `P`,

```
replayPRE(P.screen_id, P.at, P.system_state).output_checksum
  =
P.output_checksum
```

This guarantee is the primary regression gate for all PRE implementation changes. Any implementation change that causes this equality to fail — for any packet in the replay corpus — is a breaking change to PRE behavior that requires review, either to correct the implementation or to formally retire the affected replay vectors with documented justification (see Section 14).

### 3.5 Replay Harness Specification

The replay harness is a standalone verification tool. It MUST be maintained alongside the PRE implementation. It MUST NOT be a production-serving code path. It MUST be invocable from CI and from developer workstations.

**Function signature:**

```
FUNCTION replayPRE(
  packet : ReplayPacket
) : ReplayResult

TYPE ReplayResult = {
  packet_id        : STRING,
  passed           : BOOLEAN,
  actual_output    : PRE_Output,
  actual_checksum  : STRING,
  expected_checksum: STRING,
  divergence_fields: STRING[],   // fields where actual != expected
  execution_ms     : INTEGER
}
```

**Harness behavior:**

1. Deserializes `packet.system_state` into a read-only in-memory structure that implements the same database query interface as a live `DatabaseConnection`.
2. Calls the current `PRE.resolve(packet.screen_id, packet.at, in_memory_db)`.
3. Computes `fnv1a32(canonicalizeJson(actual_output))`.
4. Compares against `packet.output_checksum`.
5. If checksums match: `passed = true`, `divergence_fields = []`.
6. If checksums differ: `passed = false`, performs field-level diff to populate `divergence_fields`.
7. Returns `ReplayResult`.

The in-memory database implementation used by the replay harness MUST implement the exact same query interface contracts as the production database driver. It MUST NOT short-circuit query logic or return pre-resolved results.

### 3.6 Time-Travel Replay

The replay system supports time-travel queries: reconstructing what a screen would have displayed at a past timestamp, for diagnostic and audit purposes.

A time-travel replay differs from a standard replay in that no pre-captured `ReplayPacket` need exist. Instead:

1. Recover `SystemState` at time `at` by replaying the audit log from the beginning of the retention window through `at`, applying all mutations in `occurred_at` order.
2. Package the recovered `SystemState` into a `SystemStateSnapshot`.
3. Call `PRE.resolve(screen_id, at, snapshot_as_db)`.
4. Return the resulting `PRE_Output`.

Time-travel replay is authoritative for historical questions of the form "what was screen X showing at time T?" The audit log, not any persisted manifest, is the ground truth for such questions (ENGINEERING-CONSTITUTION-v1.md §15.4).

**Requirements for time-travel correctness:**
- The audit log MUST record full before/after state deltas for all mutations to tables in the PRE read set (ENGINEERING-CONSTITUTION-v1.md §15.2).
- Audit writes MUST be atomic with state mutations; a mutation without a corresponding audit record is a constitutional violation (§9.4).
- The audit log MUST be retained in queryable form for a minimum of 90 days, and in archival form for a minimum of 365 days (§15.4).

### 3.7 Historical Reconstruction from Audit Log

To reconstruct `SystemState` at time `T` for screen `S`:

```
FUNCTION reconstructSystemState(screen_id, at_utc_ms, audit_log) : SystemStateSnapshot

1. Gather all audit_log entries with occurred_at <= at_utc_ms
   for entity_types in PRE read set, ordered by occurred_at ASC

2. Starting from baseline empty state, apply mutations in order:
   FOR EACH entry IN ordered_audit_entries:
     apply(entry.payload.after, entity_type_to_state_map)

3. Resolve scope: filter to records relevant to screen_id's
   venue, area, tv_group, organization chain

4. Return SystemStateSnapshot with all resolved records
```

This reconstruction MUST NOT require access to the live database or the application server. It MUST be executable from the audit log alone. The audit log is the single source of truth for historical reconstruction.

### 3.8 Future-Version Replay Compatibility

Replay compatibility is a forward-looking constraint on all PRE implementation changes. Before any change to the PRE that could alter its behavioral output is merged:

1. The replay harness MUST be run against the entire current replay corpus.
2. Any corpus entries that now fail MUST be investigated to determine whether the implementation change is intentionally altering PRE behavior.
3. If the change is intentional and constitutes a valid PRE behavioral update (e.g., a bug fix), the affected corpus entries MUST be archived with documentation, and new replacement entries MUST be captured against the updated implementation.
4. If the change is unintentional (regression), the implementation MUST be corrected before merge.
5. No corpus entry MAY be silently discarded.

Compatibility constraints on the `PRE_Output` type and `SystemStateSnapshot` type: fields MAY be added with forward compatibility. Fields referenced by existing replay packets MUST NOT be removed or have their semantics changed without a formal corpus migration.

---

## 4. Property-Based Verification

### 4.1 Purpose

Unit tests verify that known fixture inputs produce expected outputs. Property tests verify that behavioral invariants hold across the entire generative space of valid inputs — including inputs that manual fixture construction would never produce. Property testing catches corner cases that are combinatorially unreachable through manual test design.

On the ClubHub TV platform, property-based verification serves a specific role: proving that PRE invariants INV-1 through INV-10 are not fixture-dependent properties but genuine algorithmic properties of the implementation.

### 4.2 Invariant Fuzzing

The property test suite MUST exercise each PRE invariant as a property that is verified to hold across randomly-generated `SystemState` inputs. For each invariant, the property is:

**INV-1 (Purity):** No call to `PRE.resolve()` produces an observable side effect. Verified by wrapping PRE in an environment that intercepts any attempted write operation, network call, or environment variable read and fails the property immediately.

**INV-2 (Totality):** For all generated `(screen_id, at, SystemState)` inputs, `PRE.resolve()` returns a valid `PRE_Output` value. It MUST NOT throw, return null, or return undefined. Verified by asserting on every generated call that the return value is a non-null `PRE_Output` with all required fields present.

**INV-3 (Determinism):** Two calls to `PRE.resolve()` with identical inputs produce bit-identical output. Verified by calling PRE twice with the same generated state and asserting checksum equality.

**INV-4 (Monotone Versioning):** Version sequences for a screen are non-decreasing. Verified by generating sequences of `SystemState` transitions and asserting that the version emitted for each successive state is `>= previous`.

**INV-5 (Level Termination):** If PRE terminates at Level N, no Level above N contributes to `base_playlist`. Verified by generating states that trigger termination at each level and asserting that `reason_trace` entries for higher levels record "not evaluated".

**INV-6 (No Content Amplification):** All `content_id` values in output playlist are strict subsets of `content_id` values referenced by active rules in the input `SystemState`. Verified by asserting set containment after every generated resolution.

**INV-7 (Emergency Absoluteness):** Active emergency states produce output containing only emergency content (or System Fallback when emergency content is absent). Verified by generating states with active emergencies and asserting that no campaign, override, or sponsor content appears.

**INV-8 (Sponsorship Non-Penetration):** Sponsor injection is absent in outputs that terminate at Level 0 or Level 1. Verified by generating Level 0 and Level 1 termination states and asserting `content_mix.sponsor_pct = 0.0`.

**INV-9 (Timezone Isolation):** Time-of-day evaluations use venue-local time derived from the venue's IANA timezone and the `at` parameter. Verified by generating states with venues in multiple timezones and asserting that schedule activation matches the venue-local wall-clock, not UTC.

**INV-10 (Output Completeness):** Every item in `active_playlist` has a corresponding entry in `reason_trace`. Verified by asserting `∀ item ∈ active_playlist: ∃ trace_entry referencing item.content_id`.

### 4.3 Random Schedule Generation

The property test suite MUST generate random `SystemState` inputs using generators that cover the full valid input space. Generators MUST include:

- Random schedule sets with varying specificity levels (SPECIFICITY_0 through SPECIFICITY_5)
- Random day-of-week constraint combinations, including empty (match-all) sets
- Random intra-day windows, including midnight-crossing windows (where `time_of_day_start > time_of_day_end`)
- Random DST transition timestamps across multiple IANA timezones
- Random campaign sets with overlapping and non-overlapping time windows
- Random override hierarchies with conflicts at the same and different specificity levels
- Random suppression override sets with varying `suppressed_campaign_ids` and `suppressed_categories`

### 4.4 Override Collision Generation

Override conflict scenarios — two or more overrides with overlapping scope and time windows at the same specificity level — MUST be explicitly exercised as a generator category. The property verified is that PRE produces deterministic output (selecting the override with highest `issued_at`, or lexicographically smaller `id` on tie) rather than throwing or returning non-deterministic results.

### 4.5 Sponsorship Saturation Fuzzing

Sponsorship scenarios MUST include generated inputs that push total share-of-voice above `MAX_SPONSOR_CAPACITY` (0.60). The property verified is that PRE's saturation enforcement (PRE-REFERENCE-IMPLEMENTATION-v1.md §11.4) produces proportional reduction such that the resulting `content_mix.sponsor_pct` is `<= 0.60` and `content_mix` percentages sum to `1.0 ± 0.001`.

### 4.6 DST Transition Fuzzing

The DST transition generator MUST produce timestamps that fall within:
- Spring-forward gaps (where `is_dst_gap = true`)
- Fall-back overlaps (where `is_dst_overlap = true`)
- The exact millisecond of transition boundaries

For each, the property verified is that PRE produces output consistent with the DST semantics defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §8: gap timestamps produce no time-of-day match; overlap timestamps cause schedules to match both occurrences of the ambiguous wall-clock hour.

### 4.7 Emergency Overlap Fuzzing

Emergency overlap scenarios MUST exercise the case where a forbidden state (FORBIDDEN-1: two active emergencies per venue) exists despite the uniqueness constraint, simulating a constraint violation. The property verified is that PRE uses the most recently activated record (highest `activated_at`) and does not throw.

### 4.8 Minimum Iteration Counts

Property tests MUST run a minimum of 1,000 iterations per invariant in CI. For DST transition fuzzing, a minimum of 500 iterations across at least 10 distinct IANA timezones. Increasing iteration counts beyond these minimums is encouraged and SHOULD be done when a new edge case is discovered.

### 4.9 Shrink Behavior and Seed Reproducibility

When a property test fails, the framework MUST shrink the failing input to the minimal example that still demonstrates the failure. The shrunk input MUST be serialized as a new fixture and committed to the test suite, so the specific failing case becomes a permanent regression test.

All property test runs MUST use a seeded deterministic pseudo-random number generator (PRNG). The seed MUST be logged on every run. When a property failure is reported, the seed MUST be included in the report so the failing sequence can be reproduced exactly by any engineer running the same seed.

**The PRNG used within PRE itself is governed separately and categorically:** PRE MUST NOT use any random number generator. PRE is a deterministic function. The PRNG used by the property test framework to generate test inputs is entirely external to PRE.

---

## 5. Manifest Equivalence Verification

### 5.1 Purpose

During the Phase 2 shadow mode period defined in IMPLEMENTATION-ROADMAP-v1.md, and during Phase 5 canary rollout, two manifest resolution systems operate simultaneously: the legacy manifest engine (under `PRE_ENABLED=false`) and the new PRE implementation. Manifest equivalence verification is the process of comparing their outputs against real production traffic to establish parity before cutover.

Parity verification does not end at Phase 5 cutover. The replay system provides ongoing equivalence verification: any future implementation change that alters PRE output is detected through replay regression.

### 5.2 Shadow-Mode Verification Pipeline

When `PRE_SHADOW_MODE=true` (IMPLEMENTATION-ROADMAP-v1.md §Feature Flags), the Manifest Delivery System MUST:

1. Resolve the manifest using the legacy engine (return path).
2. Concurrently invoke `PRE.resolve()` for the same `(screen_id, at)` pair.
3. Compare the two outputs according to the equivalence rules defined in Section 5.3.
4. If divergence is detected: log a structured divergence record, increment `shadow_divergence_total` metric, continue serving the legacy output.
5. MUST NOT: serve PRE output, block the request, or propagate the divergence to the screen.

Shadow mode divergence records MUST include: `screen_id`, `at`, `legacy_checksum`, `pre_checksum`, `divergence_class` (semantic or structural), `legacy_resolution_level`, `pre_resolution_level`, `request_id`.

### 5.3 Semantic Equivalence

Two manifest outputs are semantically equivalent if and only if:
- The ordered sequence of `content_id` values in the `active_playlist` is identical.
- The ordered sequence of `duration_ms` values in the `active_playlist` is identical.
- The computed `checksum` values are identical.
- The `is_fallback` flag is identical.

**Tolerated differences** (MUST NOT count against divergence rate):
- `reason_trace` contents (PRE provides richer traces than legacy engine)
- `confidence_score` value (PRE computes this; legacy does not)
- `valid_until` value (PRE computes precisely; legacy may differ)
- `content_mix` fields (PRE computes; legacy does not)
- `resolution_level` integer (PRE exposes this; legacy does not track resolution level)

**Forbidden differences** (MUST count against divergence rate; MUST be investigated):
- Any difference in the `content_id` sequence
- Any difference in the `duration_ms` sequence
- Any difference in the `is_fallback` flag
- Any difference in the `checksum` value

### 5.4 Parity Confidence Scoring

The shadow-mode system tracks a rolling parity confidence score defined as:

```
parity_confidence(window_hours) =
  1.0 - (semantic_divergence_count(window_hours) / total_invocations(window_hours))
```

Where `semantic_divergence_count` counts invocations where one or more forbidden differences were observed.

The Phase 2 gate requires `parity_confidence(24h) = 1.0` — zero forbidden divergences over 24 consecutive hours of shadow mode operation.

The Phase 5 canary gate requires `parity_confidence(168h) >= 0.9999` across the 7-day clean gate period (IMPLEMENTATION-ROADMAP-v1.md §Phase 5 gate).

### 5.5 Production Canary Validation

During Phase 5 canary rollout, the per-screen `screens.pre_enabled` column gates which screens receive PRE output. The canary proceeds through four steps:

1. Internal screens only (engineering verification)
2. 10% of production screens (early sampling)
3. 50% of production screens (broad equivalence validation)
4. 100% of production screens (full cutover)

At each step, the following MUST be monitored and MUST remain within tolerance before advancing:

| Signal | Tolerance |
|--------|-----------|
| p95 manifest delivery latency | `<= legacy_p99 + 20%` |
| 5xx error rate | `= 0` |
| `is_fallback` rate | `<= legacy_is_fallback_rate` |
| `screen_poll_success_rate` | `>= pre-canary baseline` |
| `manifest_cache_hit_ratio` | `>= 0.95` |

Advancing a canary step when any signal is out of tolerance is a constitutional violation (ENGINEERING-CONSTITUTION-v1.md §25.6 and §26.6).

### 5.6 Rollback Triggers

PRE cutover is reversible until the Phase 5 gate passes. The `PRE_ENABLED` environment flag MAY be set to `false` at any time before that gate to revert all screens to the legacy engine. Rollback triggers that MUST initiate a canary halt and investigation:

- Any single forbidden divergence in the 7-day clean gate period
- `is_fallback` rate exceeding legacy baseline by any amount
- Any `CONSTITUTIONAL_BREACH` severity alert (see Section 17)
- `manifest_compute_duration_ms` p95 exceeding 500ms for any 5-minute window

---

## 6. Chaos Verification Architecture

### 6.1 Purpose and Scope

Chaos verification proves that the system degrades gracefully under infrastructure failure. It does not prove uptime. It proves invariant preservation during failure.

The chaos test suite (`suites/chaos.js`) MUST remain passing on the main branch at all times. A pull request that causes a chaos test failure MUST NOT be merged until the failure is resolved or the test is explicitly amended with documented justification (ENGINEERING-CONSTITUTION-v1.md §25.4).

### 6.2 Backend Restart Recovery

**Scenario:** Application process restarts mid-operation. In-process LRU caches are lost.

**Injected failure:** Application process SIGTERM with immediate restart. All in-process cache cleared.

**Verified behavior:**
- First manifest request post-restart: PRE recomputes from database. Cache miss is expected and tolerated.
- No 5xx responses visible to polling screens.
- `manifest_cache_hit_ratio` recovers to `>= 0.95` within 2 minutes.
- PRE invariants INV-1 through INV-10 hold on first post-restart computation.

**Acceptable degradation:** Cache miss spike for `<= 120s` post-restart.
**Invariant preserved:** PRE output identical to pre-restart output for same `(screen_id, at, SystemState)`.

### 6.3 Database Restart Recovery

**Scenario:** PostgreSQL restarts, causing all active connections to fail. Database unavailable for up to 60 seconds.

**Injected failure:** `pg_ctl stop -m immediate` followed by `pg_ctl start` after configurable delay.

**Verified behavior:**
- Within `MAX_STALE_AGE` (60,000ms) of database becoming unavailable: stale in-process LRU cache entries MUST be served with degraded indicators in structured log.
- After `MAX_STALE_AGE` without database recovery: System Fallback MUST be served. `is_fallback = true` MUST appear in response.
- System Fallback MUST be served without any database access (ENGINEERING-CONSTITUTION-v1.md §17.3).
- On database recovery: PRE recomputes normally; degraded responses cease; System Fallback ceases.
- Version counter continuity MUST be preserved post-recovery (no version decrement).

**Acceptable degradation:** Stale cache served up to 60s; System Fallback after that.
**Invariant preserved:** INV-2 (Totality) — System Fallback guarantees a non-null output at all times.

### 6.4 Network Partition Simulation

**Scenario:** Application server loses network connectivity to database for a defined duration.

**Injected failure:** `iptables` rule blocking port 5432 for configurable duration.

**Verified behavior:** Identical to §6.3 database restart. The application MUST NOT distinguish between database unreachable and database restarted at the behavioral level.

**Acceptable degradation:** Stale cache served up to 60s; System Fallback after that.

### 6.5 Cache Loss Simulation

**Scenario:** `manifest_cache` table entries deleted (simulating cache store failure or manual intervention).

**Injected failure:** `DELETE FROM manifest_cache` during active polling.

**Verified behavior:**
- Cache miss triggers PRE recomputation. No 5xx responses.
- Recomputed output is identical to prior cached output (determinism property).
- Version counter: if `screen_versions` entry still exists, version is preserved. If both `manifest_cache` and `screen_versions` are cleared, version resets to 1 (acceptable as startup condition).
- New cache entries populated correctly after recomputation.

**Acceptable degradation:** Latency spike for one poll interval (15s).
**Invariant preserved:** INV-3 (Determinism) — recomputed output has same checksum as prior output for same state.

### 6.6 Stale Manifest Recovery

**Scenario:** A screen has been offline for longer than `MAX_STALE_AGE` and reconnects.

**Injected failure:** Screen poll suppressed for 90,000ms (90 seconds). Screen then resumes polling.

**Verified behavior:**
- During offline window: `confidence_score` decreases per §13.2 of PRE-REFERENCE-IMPLEMENTATION-v1.md.
- At screen reconnection: PRE recomputes against current SystemState. New manifest delivered.
- If SystemState has changed during offline window: new manifest may differ from last-served manifest. Version increments accordingly.
- No stale manifest is treated as authoritative.

**Acceptable degradation:** One-poll-interval delay on reconnection.
**Invariant preserved:** INV-3 (Determinism) — reconnection manifest is determined by current SystemState, not prior state.

### 6.7 Event Bus Lag

**Scenario:** Cache invalidation events are delayed (simulating event bus backpressure).

**Injected failure:** 30-second delay on all event bus message delivery.

**Verified behavior:**
- During lag window: stale cache MAY be served. The `valid_until` field bounds maximum staleness.
- Version-based invalidation: when event eventually delivers, cache is correctly invalidated.
- No manifest served past its `valid_until` timestamp plus `MAX_STALE_AGE` backstop.

**Acceptable degradation:** Content updates reflected with up to `valid_until + 60s` delay.
**Invariant preserved:** INV-4 (Monotone Versioning) — version counter not affected by event delivery delay.

### 6.8 Clock Skew

**Scenario:** Application server clock drifts relative to database server clock.

**Injected failure:** System clock adjusted by +/- up to 5 minutes on application server.

**Verified behavior:**
- PRE uses `at` parameter (passed by Manifest Delivery System) for all time evaluation.
- Venue-local time is derived from `at` and the venue's IANA timezone, not from the application server's wall clock.
- Schedule evaluations produce correct results relative to the `at` timestamp regardless of clock skew.
- `valid_until` computation is relative to `at`, not wall clock.

**Acceptable degradation:** None expected. Clock skew MUST NOT affect PRE output.
**Invariant preserved:** INV-9 (Timezone Isolation) — system timezone MUST NOT influence PRE.

### 6.9 Poll Storm

**Scenario:** Surge in concurrent manifest poll requests (simulating network recovery after extended outage when many screens reconnect simultaneously).

**Injected failure:** 500 concurrent poll requests issued within 1 second.

**Verified behavior:**
- System MUST sustain 500 concurrent screen polls per second per application instance without p95 latency budget degradation (ENGINEERING-CONSTITUTION-v1.md §26.5).
- p95 manifest delivery latency MUST remain `<= 500ms`.
- PRE.resolve() concurrency MUST be safe (INV-1 combined with ENGINEERING-CONSTITUTION-v1.md §16.1).
- No data corruption from concurrent version counter increments (compare-and-swap semantics per §16.2).
- No 5xx responses.

**Acceptable degradation:** p99 latency MAY exceed 500ms during storm peak.
**Invariant preserved:** INV-3 (Determinism) — concurrent invocations for same screen MUST produce same output.

### 6.10 Invariant Preservation Under Failure

All chaos scenarios MUST explicitly verify that the following invariants are preserved under the injected failure condition:

| Invariant | Verification Method |
|-----------|-------------------|
| INV-2 (Totality) | Assert non-null response for every request during failure window |
| INV-7 (Emergency Absoluteness) | Pre-activate emergency before injecting failure; assert emergency content throughout |
| INV-3 (Determinism) | Capture pre-failure output; assert post-recovery output checksum matches |
| FP-04 (No Poll Path Mutation) | Assert zero database writes occur during manifest poll path under any failure condition |

### 6.11 Explicit Statement: What Chaos Tests Verify

Chaos tests verify **graceful degradation**, not uptime perfection. The system is not expected to serve current manifests when the database is unavailable. It is expected to serve stale manifests or the System Fallback — with explicit indicators — and to recover correctly when the failure resolves. Chaos tests verify that this degradation is graceful, bounded, and non-corrupting.

---

## 7. Operational Entropy Detection

### 7.1 The Nature of Operational Entropy

A platform can be engineered correctly — every PRE invariant holding, every audit log entry sound, every chaos test passing — and still be operationally drifting. Operational entropy is the divergence between the configuration present in the system and the configuration that operators intend.

Entropy is not caused by bugs. It is caused by accumulated human decisions: overrides created under time pressure that are never reviewed, campaigns orphaned when their creators leave, sponsorship contracts individually reasonable that collectively saturate editorial capacity, emergency activations used as a flush mechanism rather than for genuine emergencies. Each decision is locally reasonable. The aggregate produces a system that operators can no longer mentally model.

The five observed degradation patterns from adversarial simulation (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §3) are the historical record of how this entropy manifests:

1. **Override Accumulation:** 35% of screens diverged to unknown, unreviewed, permanent overrides over 10 weeks — operators lost track of what was intentional.
2. **Sponsor Overbooking:** Individually reasonable SOV contracts accumulate to persistent saturation over 5 months — no single contract was wrong; the aggregate was.
3. **Emergency Feature Misuse:** 14 operational emergency activations in 60 days rendered the emergency log unable to distinguish genuine emergencies from scheduling workarounds.
4. **Campaign Fragmentation:** 70% of schedules became campaign-orphaned; the intended scheduling model became operationally irrelevant.
5. **Shadow Scheduling:** Priority scale drifted from [0–20] to [0–300] as operators escalated priorities rather than investigating why content was not winning resolution.

### 7.2 Entropy Metrics

Twelve metrics (M-01 through M-12) constitute the operational entropy measurement framework, as fully defined in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5. Each metric has advisory and review thresholds:

| ID | Name | Advisory Threshold | Review Threshold |
|----|------|--------------------|-----------------|
| M-01 | Override Divergence Rate (% screens on override vs. structural) | > 15% | > 30% |
| M-02 | Override Age Distribution (any permanent override age) | > 30 days | > 90 days |
| M-03 | Campaign Coverage Rate (% schedules with campaign_id) — inverted | < 60% | < 30% |
| M-04 | Priority Range Width (MAX - MIN active priority integer) | > 100 | > 200 |
| M-05 | Duplicate Content Pairs (same content_id at same scope) | > 3 pairs | > 8 pairs |
| M-06 | SOV Warning Duration (consecutive days above 40% sponsorship) | > 7 days | > 14 days |
| M-07 | Editorial Content Rate (% non-sponsored in resolved manifests) | < 50% | < 35% |
| M-08 | Emergency Activation Rate (count in rolling 30 days) | > 3/month | > 6/month |
| M-09 | Emergency Reason Completion (% activations with reason field) | < 70% | < 40% |
| M-10 | Orphaned Schedule Count (schedules > 60d old, no campaign, no expiry) | > 5 | > 15 |
| M-11 | Override-as-Schedule Count (permanent overrides > 30d old) | > 3 | > 8 |
| M-12 | Screen Config Staleness (% screens untouched > 90 days) | > 20% | > 40% |

### 7.3 Staleness Detection

Beyond the 12 metrics, individual configuration rows are classified into four staleness classes (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §7):

**Class A — Permanent with no review:** Override or schedule with no `expires_at` and no modification in > 30 days.
**Class B — Expiry-adjacent:** Configuration with `expires_at` within 7 days, requiring operator awareness before expiry.
**Class C — Shadow survivors:** Configuration that has never won PRE resolution in the last 30 days.
**Class D — Operator-absent:** Configuration whose `issued_by` user has been inactive for > 60 days.

The **Staleness Index** aggregates these classes per venue:

```
Staleness Index = (A_count × 3 + C_count × 2 + D_count × 1) / total_config_rows × 100
```

This index feeds into metric M-12 and is one component of the composite Entropy Score.

### 7.4 Entropy Scoring

The Entropy Score is a single dimensionless value in [0, 100] summarizing operational health of a venue. It is a triage instrument for identifying venues that deserve operator attention.

**Component weights:**

| Metric | Weight |
|--------|--------|
| M-01 Override Divergence | 25% |
| M-03 Campaign Coverage (inverted) | 20% |
| M-04 Priority Range | 15% |
| M-06 SOV Warning Duration | 15% |
| M-08 Emergency Activation Rate | 10% |
| M-11 Override-as-Schedule | 10% |
| M-12 Staleness Index | 5% |

**Normalization function** (applied per metric before weighting):

```
FUNCTION normalize(value, advisory_threshold, review_threshold):
  IF value <= 0: RETURN 0
  IF value <= advisory_threshold:
    RETURN (value / advisory_threshold) × 50
  IF value <= review_threshold:
    RETURN 50 + ((value - advisory_threshold) /
                 (review_threshold - advisory_threshold)) × 30
  ELSE:
    excess ← value - review_threshold
    RETURN MIN(100, 80 + 20 × (1 - e^(-excess / review_threshold)))
```

**Score interpretation and review cadence:**

| Score Range | Label | Operator Review Cadence |
|-------------|-------|------------------------|
| 0–20 | Healthy | Monthly |
| 21–40 | Nominal | Bi-weekly |
| 41–60 | Drifting | Weekly |
| 61–80 | Degraded | Immediate attention |
| 81–100 | Critical | Same-day operator review |

### 7.5 Entropy Computation Layer

Entropy metrics are computed by a batch process that MUST run once daily at 03:00 local venue time. The computation layer:

1. Reads `audit_log`, `overrides`, `schedules`, `campaigns`, `emergency_states`, `sponsorship_contracts`, `screen_delivery_log`, and `screens` tables.
2. Computes M-01 through M-12 for each venue.
3. Computes the Staleness Index per venue.
4. Computes the composite Entropy Score.
5. Writes a `venue_health_snapshot` record containing the full metric set, score, label, active review items, and trend delta.
6. Emits a `venue.health.computed` event on the event bus.

The entropy computation layer MUST NOT:
- Write to any configuration table (schedules, overrides, campaigns, emergency_states, sponsorship_contracts)
- Trigger cache invalidation
- Emit events that cause configuration changes
- Perform any correction, normalization, or cleanup of configuration data

This prohibition is absolute. The entropy system is observability infrastructure. It MUST NOT become a mechanism for automated configuration management.

### 7.6 Warning Tiers

Entropy signals reach operators through the three-tier advisory system defined in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §10:

**Tier 1 — Passive:** Ambient context displayed on management screens without requiring operator action. Appropriate for metrics approaching but not yet crossing advisory thresholds.

**Tier 2 — Noticed:** Visual distinction requiring operator acknowledgment or dismissal. Appropriate for metrics crossing advisory thresholds or for confirmation of risk during specific write operations.

**Tier 3 — Confirmed (friction gate):** Modal confirmation required before proceeding with a write operation. This is the maximum friction permitted. Operators MUST always be able to proceed by confirming. Examples requiring Tier 3: override creation with `expires_at IS NULL`, emergency activation when M-08 > 3/month, sponsorship creation exceeding SATURATION_WARNING_AT (0.40).

No enforcement level above Tier 3 exists. The platform MUST NOT prevent an operator from completing an intended action. The operator is the authority on intent; the platform is the authority on making the signals visible.

### 7.7 Entropy Dashboards

Five dashboards surface entropy signals (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §17):

1. **Venue Operational Health Dashboard:** Entropy score gauge, 30-day trend, metric table, active review items, per-screen resolution level map.
2. **Screen Resolution Map:** Grid of screens color-coded by `resolution_level` (0=emergency, 1=operational override, 2=scheduled override, 3=campaign, 4=sponsor-injected, 5=structural, 6=device truth annotation); staleness indicators; PRE preview drill-down per screen.
3. **Stale Configuration Review:** Tabular view organized by staleness class (A, B, C, D); shows age, creator identity, affected screens, and actions (Set Expiry, Mark Reviewed). The action list deliberately excludes Delete — expired and stale configuration is retained for audit trail.
4. **Emergency Activation Log:** Chronological log with filters for reason-absent activations and duration > 4 hours; rolling 30-day count; category tagging.
5. **Multi-Venue Operations:** Venue summary table sortable by Entropy Score; shows top REVIEW metric, last reviewed date, and drill-down to venue dashboard.

### 7.8 Entropy Review Cadence

Five operational review workflows are defined (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §18). Two are directly entropy-related:

**Weekly Entropy Review (15–30 minutes):** Venue manager and shift leads review all REVIEW-tier metrics, confirm configuration against current operational intent, and update the stale configuration list. This workflow is the primary mechanism by which entropy signals translate to operator action.

**Post-Incident Configuration Review (10–20 minutes):** After any emergency activation or P1 incident, review the emergency log to confirm the emergency was cleared correctly, identify whether the activation was an operational use or a genuine emergency, and update protocols accordingly.

### 7.9 Entropy Is Not Auto-Corrected

**This prohibition is repeated explicitly and without qualification:**

The Entropy Score MUST NOT trigger automated corrective behavior. Metrics MUST NOT trigger automated corrective behavior. Staleness classifications MUST NOT trigger automated corrective behavior. No configuration row MUST be automatically modified, expired, deleted, normalized, or rebalanced in response to any entropy signal.

Operator agency is the foundational principle. The system lacks the context to determine whether high override divergence is drift or deliberate customization. The system lacks the context to determine whether low campaign coverage reflects fragmentation or intentional scheduling philosophy. The system lacks the context to determine whether emergency misuse is an abuse pattern or a response to inadequate tooling.

Entropy signals direct operator attention. Operators make decisions. The system records the decisions and makes the resulting state visible.

---

## 8. Preview and Explainability Systems

### 8.1 The Explainability Contract

Every PRE resolution is explainable. This is not an aspiration. It is a constitutional guarantee (ENGINEERING-CONSTITUTION-v1.md §21.1). The `reason_trace` field of every `PRE_Output` MUST be sufficient — in isolation, without access to source code or additional system queries — for a human operator to reconstruct why each item appears in the playlist.

Explainability has a dual purpose:

1. **Operational transparency:** Operators understand what is playing and why. The question "why is this content showing on screen X right now?" is answerable in under 30 seconds using the Preview endpoint.

2. **Verification grounding:** All verification systems — replay, property testing, chaos testing — verify PRE behavior against its outputs, not its internals. The `reason_trace` is the human-readable expression of the same behavioral correctness that checksums and invariant monitors verify mechanically.

### 8.2 PRE Preview Endpoint

The PRE Preview endpoint is a first-class production system. Its availability MUST be monitored. Returning errors constitutes a P2 incident (ENGINEERING-CONSTITUTION-v1.md §28.5).

**Endpoint specification:**

```
GET /api/preview/screen/:screen_id
Query parameters:
  at    : ISO 8601 timestamp (optional; defaults to current time)
  trace : boolean (optional; defaults to true)
```

**Response schema (200 OK):**

```json
{
  "screen_id": "...",
  "resolved_at": "2026-05-20T19:00:00.000Z",
  "resolution_level": 3,
  "is_fallback": false,
  "confidence_score": 0.9700,
  "content_mix": [
    {
      "content_id": "...",
      "duration_ms": 30000,
      "weight": 0.50,
      "source": "campaign",
      "sponsored": false
    }
  ],
  "reason_trace": {
    "level_0_emergency": null,
    "level_1_operational_override": null,
    "level_2_scheduled_override": null,
    "level_3_campaign": {
      "campaign_id": "...",
      "campaign_name": "Summer Menu 2026",
      "schedule_id": "...",
      "won_by": "area-specificity"
    },
    "level_4_sponsorship": {
      "contracts_active": 1,
      "total_sov_pct": 0.25,
      "sov_warning_active": false,
      "injected_items": 1
    },
    "level_5_structural": null,
    "level_6_device_truth": {
      "confidence_score": 0.9700,
      "last_seen_ms_ago": 8500,
      "checksum_match": true
    }
  },
  "divergence_advisory": {
    "has_active_overrides": false,
    "area_schedule_diverged": false
  },
  "computed_ms": 14,
  "preview": true
}
```

**Invariants of the Preview endpoint:**

1. Preview calls `PRE.resolve()` directly against live system state.
2. Preview responses MUST include `"preview": true` in all responses. This field prevents any downstream system from treating a preview response as authoritative manifest delivery.
3. Preview MUST NOT affect manifest cache, version counter, delivery log, audit log (except a read-only `preview_access` log entry), or any persistent state.
4. Preview is authoritative for the question "what would play on this screen if PRE were invoked right now?" — it is not a simulation, estimate, or approximation.
5. The `?at=` parameter enables future-time and past-time simulation. Future-time simulation uses live state plus the provided timestamp. Past-time simulation reconstructs `SystemState` from the audit log for the provided past timestamp.

### 8.3 Four Preview Surfaces

Four specialized preview surfaces answer distinct operator workflow questions (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §8):

**P-1: Screen Playback Preview** — "What would play on screen X at time T?"
Input: `screen_id`, optional timestamp. Output: Full PRE output including `content_mix`, `reason_trace`, `confidence_score`.

**P-2: Campaign Delivery Preview** — "Which screens will this campaign reach?"
Input: `campaign_id`. Output: Per-screen breakdown showing: will reach (campaign wins resolution), won't reach (override blocking), unreachable (unprovisioned or offline).

**P-3: Override Impact Preview** — "Which screens are affected by this override?"
Input: `target_type`, `target_id`, `content_id`, `expires_at`. Output: Affected screens, their current resolution source, campaigns that would be shadowed by the override.

**P-4: Area Schedule Reality Check** — "Does the area schedule match actual screen resolutions?"
Input: `area_id`. Output: Per-screen breakdown of `resolution_level`, which level is terminating (if not campaign layer), and override or emergency details where relevant.

Each preview surface calls PRE directly. None implements approximation logic, client-side interpolation, or cached result reuse. The preview endpoints are the authoritative answer to the question posed, not an estimate.

### 8.4 Future-Time Simulation

The `?at=` parameter on the Preview endpoint accepts future timestamps. When a future timestamp is provided:

1. PRE reads the current live `SystemState`.
2. PRE resolves against the provided future timestamp, evaluating all time-based constraints (schedule windows, override expiry, sponsorship contract periods) at the future time.
3. The output shows what would play at that future time given the configuration currently in the system. It does not account for configuration changes that might be made between now and that future time.

Future-time preview is explicitly advisory. Its response MUST include a `"speculative": true` flag alongside `"preview": true` when the `at` timestamp is in the future.

### 8.5 "Why Is This Playing?" Operator Workflow

An operator observing content on a screen and asking "why?" follows this path:

1. Open the Screen Resolution Map dashboard for the relevant venue.
2. Identify the screen and its current `resolution_level` (color-coded).
3. Click to drill down to the PRE Preview response for that screen.
4. Read `reason_trace` for the relevant resolution level.

The `reason_trace` MUST be sufficient to answer the question without any additional query or tool access. If the `reason_trace` requires cross-referencing a campaign ID against a separate campaign lookup, the trace is insufficiently explanatory. The trace MUST include campaign name, schedule name, and the specificity level at which the rule won, in human-readable natural language.

### 8.6 "What Will Play?" Operator Workflow

An operator scheduling a campaign and asking "will this campaign reach screen X at time T?" follows this path:

1. Use P-2 (Campaign Delivery Preview) to inspect per-screen resolution before publishing.
2. For any screen showing "won't reach," use the Preview endpoint with `?at=T` to understand what is blocking the campaign.
3. Read `reason_trace` from the Preview response.
4. Optionally use P-3 (Override Impact Preview) to understand the override blocking the campaign.

This workflow is fully self-contained. No custom tooling is required. No source code access is required.

---

## 9. Observability Architecture

### 9.1 Observability as Verification Infrastructure

Observability signals are not supplementary monitoring. They are verification infrastructure. They are the mechanism by which the production system continuously proves its own operational correctness.

Three distinct purposes are served by observability:

1. **Engineering validation:** Metrics like `manifest_compute_duration_ms` validate that performance constraints (ENGINEERING-CONSTITUTION-v1.md §26) are being met in production.

2. **Invariant monitoring:** Signals like `emergency_active_count` and `version_counter_per_screen` enable continuous verification of constitutional invariants in the live system.

3. **Entropy detection:** Signals like `entropy_score_per_venue` and `override_active_count` power the operational health model defined in Section 7.

All three purposes are served by the same signal infrastructure. The taxonomy below organizes signals by purpose.

### 9.2 Required Metrics

The following metrics MUST be present in all production deployments (ENGINEERING-CONSTITUTION-v1.md §28.1):

**Operational metrics:**

| Signal Name | Type | Retention | Purpose |
|-------------|------|-----------|---------|
| `manifest_compute_total` | counter | 30 days | Total PRE invocations |
| `manifest_compute_duration_ms` | histogram | 30 days | PRE latency budget validation (§26.2: p95 ≤ 200ms) |
| `manifest_cache_hit_ratio` | gauge | 30 days | Cache effectiveness |
| `manifest_errors_total` | counter | 30 days | PRE failure rate |
| `pre_resolution_level_dist` | histogram | 30 days | Resolution level distribution |
| `screen_poll_success_rate` | gauge | 30 days | Screen connectivity health |
| `emergency_active_count` | gauge | 30 days | Active emergency state count |
| `override_active_count` | gauge | 30 days | Active override count |
| `audit_write_failures_total` | counter | 30 days | Audit log integrity signal |

**Constitutional monitoring metrics:**

| Signal Name | Type | Retention | Purpose |
|-------------|------|-----------|---------|
| `version_counter_per_screen` | gauge | 90 days | Version monotonicity verification |
| `ota_ring_rollback_total` | counter | 90 days | OTA safety tracking |
| `entropy_score_per_venue` | gauge | 90 days | Venue health trending |

**Shadow mode metrics (Phase 2 and Phase 5 canary only):**

| Signal Name | Type | Retention | Purpose |
|-------------|------|-----------|---------|
| `shadow_divergence_total` | counter | 30 days | Parity verification |
| `shadow_divergence_class` | histogram by class | 30 days | Semantic vs. structural divergence classification |
| `canary_is_fallback_rate` | gauge | 30 days | Canary safety monitoring |

### 9.3 Structured Logging

Every manifest computation MUST emit a structured log line containing (ENGINEERING-CONSTITUTION-v1.md §28.2):

```json
{
  "level": "INFO",
  "event": "manifest_computed",
  "screen_id": "...",
  "version": 47,
  "checksum": "9a4b2c1e",
  "resolution_level": 3,
  "cache_hit": false,
  "duration_ms": 18,
  "is_fallback": false,
  "request_id": "...",
  "at": 1748390400000
}
```

Additionally, the following events MUST produce dedicated structured log entries:

| Event | Required Fields |
|-------|----------------|
| Emergency activated | `venue_id`, `emergency_id`, `activated_by`, `content_id` (or null), `activated_at` |
| Emergency cleared | `venue_id`, `emergency_id`, `cleared_by`, `duration_ms`, `cleared_at` |
| Override created | `screen_id` or scope, `override_id`, `issued_by`, `expires_at` (or null), `override_type` |
| Override expired/cleared | `override_id`, `expiry_reason`, `duration_ms` |
| Cache invalidation | `trigger_event`, `scope`, `screen_count_invalidated`, `invalidation_id` |
| PRE recompute triggered | `screen_id`, `trigger`, `prior_checksum`, `new_checksum` |
| System Fallback served | `screen_id`, `trigger`, `duration_since_last_compute_ms` |
| Stale cache served | `screen_id`, `cache_age_ms`, `max_stale_age_ms` |
| Constitutional violation detected | `violation_type`, `entity_id`, `details` |

### 9.4 Audit Correlation IDs

Every operator-initiated state mutation emits an audit event containing `request_id` (ENGINEERING-CONSTITUTION-v1.md §9.2). This `request_id` MUST be propagated through the full causal chain of events:

1. Operator action → API request → `request_id` generated.
2. `request_id` attached to: audit event, structured log entries for the mutation, cache invalidation events triggered by the mutation, metrics increments triggered by the mutation.

This enables incident investigations to trace from any observable effect (cache invalidation, version increment, manifest change) back to the specific operator action that caused it, without source code access.

### 9.5 Manifest Resolution Tracing

For every manifest computation, a trace MUST be available that shows the evaluation path through the 7 resolution levels. This trace is the machine-readable form of the same information expressed in human-readable form in `reason_trace`.

The resolution trace is stored as a field in the `manifest_cache` table (or equivalent), associated with the cached output. It is the basis for:

- P-1 preview responses (the trace is returned directly)
- Entropy metric M-07 (editorial content rate, derived from `content_mix`)
- Replay verification (the trace records which resolution path was taken)

### 9.6 Cache Invalidation Tracing

Every cache invalidation MUST be logged with the triggering event, the scope of invalidation (screen count), and a unique `invalidation_id`. This enables reconstruction of exactly which screens were invalidated at what time, enabling post-hoc verification that:

- Emergency activations triggered synchronous full-venue invalidation (ENGINEERING-CONSTITUTION-v1.md §23.1)
- Override creation triggered scope-appropriate invalidation (cache invalidation table §14.2 in PRE-REFERENCE-IMPLEMENTATION-v1.md)
- Time-based invalidation was bounded by `valid_until`

### 9.7 Entropy Telemetry

Daily entropy computation events MUST produce a structured log entry for each venue:

```json
{
  "level": "INFO",
  "event": "entropy_computed",
  "venue_id": "...",
  "entropy_score": 34.2,
  "score_label": "Nominal",
  "delta_7d": 5.1,
  "primary_driver": "M-01",
  "computed_at": 1748390400000,
  "metrics": { /* M-01 through M-12 values */ }
}
```

This telemetry, combined with the `entropy_score_per_venue` gauge metric, enables 90-day trend visualization and drift detection.

### 9.8 Severity Separation

Observability signals are classified by domain:

**Operational metrics:** Latency, cache hit rate, poll success rate, error rates — signals that tell on-call engineers whether the system is functioning within performance bounds.

**Semantic metrics:** `pre_resolution_level_dist`, `entropy_score_per_venue`, `override_active_count` — signals that tell venue managers whether configuration is producing the intended schedule behavior.

**Business metrics:** `content_mix` distributions over time, `campaign_delivery_pct` per campaign — signals that inform whether sponsorship and campaign obligations are being fulfilled.

**Constitutional violation signals:** `audit_write_failures_total`, forbidden state monitoring queries, `version_counter_per_screen` monotonicity checks — signals that indicate architectural invariant violations requiring immediate investigation.

These four categories MUST be routed to distinct audiences with distinct alerting policies. An on-call engineer MUST NOT be paged for a semantic metric drift. A constitutional violation MUST alert on-call within 60 seconds.

### 9.9 Log Retention Classes

| Class | Examples | Queryable Retention | Archival Retention |
|-------|----------|--------------------|--------------------|
| Constitutional | Audit events, emergency activations | 90 days | 365 days |
| Operational | Manifest computations, cache invalidations | 30 days | 90 days |
| Entropy | Venue health snapshots, entropy events | 90 days | 365 days |
| Shadow mode | Divergence records | 60 days (post-Phase 5) | 90 days |

### 9.10 Metrics Cardinality Limits

Metrics labels MUST NOT include high-cardinality values (individual `screen_id`, `request_id`, or content IDs). Cardinality limits:

- `pre_resolution_level_dist`: labels = {resolution_level: 0-6}. Maximum 7 label combinations.
- `entropy_score_per_venue`: one time series per venue. Maximum = venue count.
- `manifest_compute_duration_ms`: no per-screen labels. Aggregate histogram only.
- `version_counter_per_screen`: recorded as per-screen gauge but aggregated into percentile summaries for alerting.

### 9.11 Replay Artifact Retention

All replay packets (Section 3.2) are retained permanently. They are not subject to any retention policy that would delete or expire them. The replay corpus grows monotonically (Section 14). Replay artifacts are stored in a dedicated store separate from operational logs, subject to their own backup and integrity verification schedule.

---

## 10. Constitutional Enforcement

### 10.1 Purpose

Constitutional enforcement is the automated detection of violations of the rules defined in ENGINEERING-CONSTITUTION-v1.md. Enforcement operates at three points in the platform's lifecycle: at development time (static analysis, contract checks), at deploy time (CI gates, migration linting), and in production (invariant monitors, forbidden state detection).

No engineer may bypass constitutional gates silently. This statement is not aspirational. It is a requirement with enforcement consequences: CI gates MUST NOT provide bypass mechanisms that do not generate a permanent audit record. Emergency bypasses (see §10.7) MUST be documented in an incident record within 24 hours.

### 10.2 Invariant Monitors

The following invariants MUST be continuously monitored in production with independent queries running on a scheduled interval (maximum 15-minute gap between checks):

**FORBIDDEN-1 (Two active emergencies per venue):**
```sql
SELECT venue_id, COUNT(*) AS emergency_count
FROM emergency_states
WHERE status = 'active'
GROUP BY venue_id
HAVING COUNT(*) > 1;
```
Expected result: zero rows. Any row is a CONSTITUTIONAL_BREACH alert.

**FORBIDDEN-2 (Screen area_id inconsistent with tv_group's area_id):**
```sql
SELECT s.id FROM screens s
JOIN tv_groups g ON s.tv_group_id = g.id
WHERE s.area_id != g.area_id;
```
Expected result: zero rows.

**FORBIDDEN-3 (manifest_cache version = 0):**
```sql
SELECT * FROM manifest_cache WHERE version = 0;
```
Expected result: zero rows.

**FORBIDDEN-4 (Schedule with starts_at >= ends_at):**
```sql
SELECT * FROM schedules
WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at >= ends_at;
```
Expected result: zero rows.

**FORBIDDEN-5 (Override with end_time <= start_time):**
```sql
SELECT * FROM overrides
WHERE end_time IS NOT NULL AND end_time <= start_time;
```
Expected result: zero rows.

**FORBIDDEN-6 (Sponsorship share outside valid range):**
```sql
SELECT * FROM sponsorship_contracts
WHERE share_of_voice <= 0 OR share_of_voice > 100;
```
Expected result: zero rows.

**FORBIDDEN-9 (Version decrement):** Monitored through `version_counter_per_screen` metric — any gauge value lower than its prior recorded maximum for the same screen is a version decrement. Alerts immediately.

**FORBIDDEN-10 (Mandate suppression by non-org-admin):** Enforced at creation time in Override Service. Monitored in audit log by checking for `event_type = 'override.created'` where payload references `is_mandated = true` campaign and `actor_role != 'org_admin'`.

### 10.3 Forbidden-Pattern Detection

Static analysis checks (`validate-contracts.js`) MUST run on every CI build and detect the following patterns:

**FP-01 (Duplicate Resolution Logic):** Any file outside the designated PRE module directory containing code that implements schedule evaluation, time-window calculation, specificity comparison, or content ordering logic.

**FP-02 (Side Effects in PRE):** Any call within the PRE module to: write-mode database methods, cache set operations, event emitters, `console.log` (use structured logger outside PRE instead), or any function that modifies state.

**FP-04 (Mutation on Poll Path):** Any database write operation reachable from the `GET /api/manifest/:screenId` handler.

**FP-06 (Automatic Corrective Behavior):** Any code path that modifies scheduling, override, emergency, or sponsorship configuration in response to a computed signal (entropy score, confidence score, divergence classification) without an explicit operator-initiated API request.

**FP-07 (Hardcoded Threshold Values):** Numeric literals for scheduling thresholds, sponsorship capacity limits, performance budgets, or entropy metric thresholds embedded in logic code rather than in authorized configuration constants.

**FP-10 (Timezone Ambiguity):** Usage of `new Date()`, `Date.now()`, `new Date().toLocaleDateString()`, or any equivalent in the resolution path. All time operations in the resolution path MUST use the explicit `at` parameter.

**FP-15 (Unversioned Cache Invalidation):** Any manifest cache invalidation triggered by TTL alone, without version counter comparison.

### 10.4 Migration Linting

All migration files MUST pass linting before deployment:

1. Every migration file MUST contain a rollback procedure comment block specifying whether rollback is possible and, if so, the exact SQL required.
2. Migration files MUST NOT contain: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` as auto-run operations. These MUST be flagged for manual execution.
3. `CREATE INDEX` on tables in the PRE read set MUST be `CREATE INDEX CONCURRENTLY`.
4. Migration numbering MUST be monotonically increasing integers; gaps are permitted; renumbering of existing files is a lint failure.
5. Migration files MUST NOT modify the `computeChecksum()` function or any checksum-related constant before Phase 6 (IMPLEMENTATION-ROADMAP-v1.md §Technical Debt Containment rule 4).

### 10.5 Replay Regression Gates

Before any PR touching PRE implementation code is merged, the replay harness MUST be run against the current replay corpus and all tests MUST pass. This is a blocking CI gate, not an advisory.

The phrase "the behavior intentionally changed" does not dissolve the gate. It initiates the corpus retirement process (Section 14.3) which culminates in new corpus entries passing the gate, at which point merge proceeds.

### 10.6 PRE Purity Verification

The PRE purity gate verifies INV-1 at the CI level:

1. Instrument the PRE invocation to intercept all calls to: database write methods, cache write methods, event emitters, network clients, environment variable readers, wall-clock functions.
2. Execute the full PRE unit test suite through the instrumented invocation.
3. If any intercepted call is detected: CI fails with CONSTITUTIONAL_BREACH classification.

This gate supplements the static analysis check for FP-02 with dynamic verification that covers code paths that static analysis may not reach.

### 10.7 Emergency Override Procedures for Deploys

In production P0 incidents, it may be necessary to deploy a change that has not completed all CI gates. The following protocol applies:

1. The deploying engineer MUST create an incident record documenting: the specific gates bypassed, the justification, and the expected resolution path.
2. The deployment MUST be tagged in the deployment log with `emergency_bypass: true`.
3. The full constitutional amendment process MUST be completed within 5 business days (ENGINEERING-CONSTITUTION-v1.md §30.4).
4. If the bypassed gate revealed a genuine constitutional issue (e.g., a replay regression from a PRE fix that was urgently needed), the replay corpus MUST be updated within the same 5-business-day window.

No engineer may bypass a constitutional gate without creating this audit trail. The absence of an incident record for a tagged `emergency_bypass` deployment is itself a constitutional violation.

### 10.8 Constitutional Violation Severity Levels

See Section 17 for the full severity classification matrix. For constitutional enforcement purposes:

- FORBIDDEN-state detected in production → CONSTITUTIONAL_BREACH
- PRE purity gate failure → CONSTITUTIONAL_BREACH
- FP-02 (side effect in PRE) detected in static analysis → CONSTITUTIONAL_BREACH (blocks merge)
- Replay regression without corpus update → ERROR (blocks merge)
- Entropy metric at REVIEW threshold → ADVISORY
- Migration without rollback comment → WARNING (blocks deploy)

---

## 11. Human Factors Safety

### 11.1 The Operator Agency Principle

The platform exists to serve venue operators. All verification and safety systems MUST be evaluated against the question: "Does this make it easier or harder for the operator to understand what the platform is doing and act on that understanding?"

Enforcement mechanisms that prevent operators from completing their work — even when the operator's intended action might produce suboptimal outcomes — are fundamentally wrong on this platform. The operator holds the business context that the system lacks. Blocking an operator's action requires the system to correctly infer intent, which is epistemically impossible.

The correct response to operator decisions that may produce poor outcomes is to make the likely outcome visible before the decision is confirmed. This is why the advisory system exists. This is why the Tier 3 confirmation gate is the maximum friction level.

### 11.2 Confirmation Gate Philosophy

Tier 3 confirmation gates — modal dialogs requiring explicit operator confirmation before proceeding — are the maximum intervention the system may apply to an operator-initiated action.

The philosophy governing their use:

1. **Friction is proportional to risk.** Low-risk actions (campaign preview) require no friction. High-risk or frequently-misunderstood actions (creating a permanent override, emergency activation) require Tier 3 confirmation.

2. **Friction gates are informative, not blocking.** The confirmation dialog MUST present specific, actionable information about the likely consequence of the action — not a generic warning. "This override will shadow the Summer Menu 2026 campaign on 12 screens indefinitely. Confirm?" is informative. "Warning: override detected. Continue?" is useless friction.

3. **Operators can always proceed.** The Tier 3 gate presents a Cancel and a Confirm button. There is no escalation path, no administrator approval, no waiting period. The operator acknowledges the consequence and proceeds.

4. **Friction gates create audit records.** The operator's confirmation is recorded in the audit log alongside the action. This creates a record of informed decision, not a record of an operator blindly dismissing warnings.

5. **Tier 3 confirmations do not remember.** If the operator cancels and immediately re-initiates the same action, the confirmation gate fires again. There is no "I understand, stop asking" persistent dismissal that the system can issue.

### 11.3 Warning Fatigue Prevention

Warnings that fire too frequently lose meaning. An operator who sees the same advisory every day on the same screen learns to ignore it. When the advisory indicates a genuinely critical condition, the operator has been trained not to notice.

Warning fatigue prevention rules:

1. **Advisory consolidation:** Multiple advisory conditions for the same venue or screen MUST be consolidated into a single advisory block, not displayed as separate individual warnings. The advisory block summarizes the conditions; the operator drills in for detail.

2. **Contextual display only:** Advisories MUST appear only when contextually relevant — in the workflow where the operator is taking an action that intersects with the condition. Venue override advisories MUST NOT appear on a campaign scheduling screen for a different venue.

3. **Tier 2 advisories are dismissible:** An operator who acknowledges a Tier 2 advisory dismisses it for the current session. The advisory does not persist beyond the current interaction unless the underlying condition worsens.

4. **REVIEW-tier metrics trigger human review, not system alerts:** Metrics at the REVIEW threshold trigger the Weekly Entropy Review workflow (Section 7.8), not automated alerts. Human review within the appropriate cadence is the designed response.

5. **Advisory expiration:** An advisory for a specific configuration issue MUST expire if the underlying metric returns to the healthy range. Advisories MUST NOT persist indefinitely for conditions that have resolved.

### 11.4 Advisory Escalation Rules

An advisory escalates from Tier 1 to Tier 2 when:
- A metric crosses from advisory threshold into REVIEW threshold range.
- A staleness class A item exceeds 60 days without modification or review.
- An entropy score crosses from Nominal (≤40) into Drifting (>40) territory.

An advisory escalates from Tier 2 to Tier 3 when:
- An operator is about to take a write action that the OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §10 advisory rules specify as Tier 3 eligible.
- Tier 3 eligibility is determined by action type and current metric values, not by time alone.

No advisory level automatically escalates to blocking. Blocking is not a permitted escalation outcome.

### 11.5 Operational UX Principles

These principles govern all operator-facing surfaces of the verification and safety systems:

1. **Specificity over generality:** Name the specific entities. "Override on screen G12 shadows campaign Summer Menu 2026" is better than "override detected."

2. **Recency matters:** Advisory messages MUST include the timestamp of the underlying condition, not just its existence.

3. **Resolution path visible:** Every advisory MUST include or link to the action that resolves the condition, if one exists. An advisory without a resolution path is anxiety, not information.

4. **Preview before commit:** All write workflows that have non-trivial downstream effects MUST offer preview of those effects before the write is submitted. The P-3 (Override Impact Preview) and P-2 (Campaign Delivery Preview) surfaces exist for this purpose.

5. **Diagnosis without source code:** On-call engineers MUST be able to diagnose any P1 incident using only: the audit log, structured logs, health endpoint responses, and the PRE Preview endpoint. No custom tooling, no source code access, no database shell access (ENGINEERING-CONSTITUTION-v1.md §12.5).

---

## 12. Long-Term Drift Prevention

### 12.1 The Drift Problem

Systems drift. Operational reality evolves faster than architecture documents. Configuration assumptions made at platform inception gradually diverge from actual use patterns. Engineering teams turn over. The engineers who understood why a particular decision was made leave, and their successors encounter the results without the context.

The ClubHub TV platform addresses this through continuous validation rather than point-in-time audits. Four distinct forms of drift require ongoing prevention programs:

### 12.2 Semantic Drift

**Definition:** The behaviors the platform produces diverge from the behaviors operators expect and intend. The platform is technically correct — all invariants hold, all tests pass — but the content on screens no longer reflects what venue operators believe they have configured.

**Detection mechanism:** Entropy metrics M-01 through M-12, Staleness Index, Entropy Score. These signals detect semantic drift before it reaches the point where operators lose confidence in the platform.

**Prevention program:**
- Weekly Entropy Review workflow (Section 7.8) — recurring operator review of entropy signals.
- Campaign Publish Pre-Check workflow — delivery preview before each campaign publication.
- P-4 Area Schedule Reality Check — on-demand validation that area configuration produces expected per-screen resolution.

**Review cadence:** Weekly for venues scoring Drifting (41–60) or above. Monthly for Healthy venues.

### 12.3 Architectural Drift

**Definition:** The system's implementation diverges from the principles and invariants defined in the ENGINEERING-CONSTITUTION-v1.md and this document. Forbidden patterns accumulate. PRE purity is eroded by small violations. Checksum semantics are subtly altered.

**Detection mechanism:** Constitutional enforcement layer (Section 10) — static analysis, forbidden pattern detection, migration linting, invariant monitors, replay regression gates.

**Prevention program:**
- Quarterly replay audit (Section 12.5): run the full replay corpus against the current implementation. Measure how many corpus entries still pass. Track the trend.
- Constitutional violation review: any CONSTITUTIONAL_BREACH severity event triggers a root cause analysis whose findings are documented and whose corrective actions are tracked.
- Amendment history review: semi-annual review of the amendment history in ENGINEERING-CONSTITUTION-v1.md to ensure active architectural assumptions reflect current reality.

**Review cadence:** Quarterly for replay audit; semi-annual for amendment review.

### 12.4 Implementation Drift

**Definition:** The implementation diverges from the behavioral specification in PRE-REFERENCE-IMPLEMENTATION-v1.md. This may happen through: incremental changes that individually seem minor but collectively alter behavior; language or library upgrades that change underlying semantics; optimizations that modify resolution order subtly.

**Detection mechanism:** Replay regression gates (Section 10.5) detect implementation drift against historical behavior. Property tests (Section 4) detect implementation drift against formal invariants.

**Prevention program:**
- Replay regression gate on every PRE-touching PR.
- Checksum test vector validation (PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B) on every build.
- Implementation drift review: when replay corpus entries accumulate a significant volume of intentional updates over a rolling 6-month window, review whether the accumulated changes represent intended behavioral evolution or gradual drift from the specification.

**Review cadence:** Automated (every PR). Manual review when > 10% of corpus entries have been retired and replaced in a 6-month window.

### 12.5 Quarterly Replay Audit

Once per quarter, the replay harness MUST be run against the complete replay corpus and a Quarterly Replay Audit Report MUST be produced. The report contains:

- Total corpus size (packet count).
- Pass rate (% of packets that produce identical output with current implementation).
- Failure breakdown: count of failures by cause (behavior change, corpus format mismatch, implementation bug).
- Any CONSTITUTIONAL_BREACH findings surfaced during the audit.
- Corpus health: count of golden vectors, incident captures, property-shrink entries, and production samples.

The Quarterly Replay Audit Report is a permanent artifact. It is retained in the same store as the replay corpus.

If pass rate falls below 100% for any reason other than documented corpus retirements (Section 14.3), the audit is classified as a failure and triggers an engineering investigation before the next deployment cycle.

### 12.6 Entropy Review Process

The Weekly Entropy Review (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §18.1) is the primary ongoing entropy governance mechanism. Quarterly, this process is augmented by an Entropy Trend Review:

- Compares current Entropy Scores for all venues against scores from 90 days prior.
- Identifies venues with increasing trend slopes (entropy increasing week-over-week).
- Reviews the primary driver metric for each worsening venue.
- Documents whether the entropy reflects intentional operational choices or unintended drift.

The Entropy Trend Review is operator-facing. Its output is a list of venues requiring configuration review, the specific metrics of concern, and recommended review workflows. It does not trigger automated action.

### 12.7 Threshold Recalibration

The advisory and review thresholds for M-01 through M-12 (Section 7.2) are defined based on observed operational patterns from adversarial simulation scenarios. As the platform accumulates real operational data across diverse venue types, these thresholds may require recalibration.

Threshold recalibration MUST be performed no more than once per year, driven by evidence from operational data, and documented as a formal threshold update with:
- Specific evidence from operational telemetry supporting the change.
- Before and after threshold values.
- Expected impact on Entropy Score distribution.
- Rationale for why the new threshold more accurately reflects problematic vs. acceptable states.

Threshold values MUST NOT be embedded as literals in logic code (FP-07). They MUST reside in `thresholds.json` or equivalent authoritative configuration source, enabling recalibration without code changes.

### 12.8 Invariant Review Cadence

Once per year, the PRE invariants (INV-1 through INV-10), forbidden patterns (FP-01 through FP-15), and forbidden states (FORBIDDEN-1 through FORBIDDEN-10) MUST be reviewed to verify:

1. Each invariant still reflects the intended architectural property.
2. Each forbidden pattern still addresses a real risk (not a historical concern that no longer applies).
3. No new invariant should be added that current verification does not cover.
4. No existing invariant has been silently violated through accumulated implementation drift.

New invariants or forbidden patterns discovered during this review require constitutional amendment per ENGINEERING-CONSTITUTION-v1.md §30.

### 12.9 Replay Corpus Evolution

The replay corpus is a living artifact that MUST grow over time. Production incidents and edge cases discovered through property testing become permanent corpus entries (Section 14). The corpus evolution review (quarterly, coinciding with the replay audit) assesses:

- Coverage of the formal edge case taxonomy (EC-1 through EC-14 from PRE-REFERENCE-IMPLEMENTATION-v1.md §24).
- Coverage of all resolution levels (LEVEL_0 through LEVEL_6), including co-occurrence cases.
- Coverage of DST transition scenarios across multiple IANA timezones.
- Coverage of all midnight-crossing schedule day-of-week combinations.
- Coverage of sponsorship saturation scenarios including exactly-at-capacity cases.
- Coverage of all five degradation patterns from adversarial simulation.

Gaps in coverage identified by this review MUST be addressed by adding new corpus entries before the next quarterly audit.

---

## 13. Failure Philosophy

### 13.1 Acceptable vs. Catastrophic Failures

The ClubHub TV platform operates within a defined failure philosophy: some failures are acceptable, some are degraded-but-tolerable, and some are catastrophic. Understanding which category applies to a given failure mode determines the correct response.

The following classifications are constitutional and MUST inform all system design decisions:

### 13.2 Acceptable Failures

**Serving stale manifests within MAX_STALE_AGE (60,000ms):** Acceptable. The stale manifest was computed by PRE against a valid SystemState. It remains deterministically reproducible from the replay system. It is explicitly marked as degraded in structured logs. Screens continue to display content.

**System Fallback served during database unavailability:** Acceptable. The System Fallback is compile-time constant, requires no external dependency, and is explicitly indicated as fallback in `is_fallback: true`. Operators see the degraded state through monitoring.

**Cache miss spike after application restart:** Acceptable. The cache miss triggers PRE recomputation, which produces correct output. The performance impact is bounded and temporary.

**Single missed poll from a screen:** Acceptable. Class A divergence (PRE-REFERENCE-IMPLEMENTATION-v1.md §20.2). Expected duration ≤ 15 seconds. Not an error.

**DST fall-back causing a schedule to match twice:** Acceptable. This is defined correct behavior per PRE-REFERENCE-IMPLEMENTATION-v1.md §8.3. The schedule appears during both occurrences of the ambiguous wall-clock hour. This is wall-clock-correct behavior.

**Override expiry lag up to 30 seconds:** Acceptable. PRE evaluates overrides using temporal constraints, not just the `status` field. A 30-second delay in the expiry background job does not cause a behavioral error; PRE will correctly exclude the override at the configured `end_time`.

### 13.3 Degraded but Tolerable Failures

**Database connectivity intermittent (connections timing out inconsistently):** Degraded. Some requests served from stale cache, some from live PRE computation. Performance impacts are non-zero. Requires monitoring and investigation if sustained.

**Event bus lag causing delayed cache invalidation:** Degraded. Content updates reflected after the lag period. Within the `valid_until` window, the delay is bounded and observable.

**Screen degraded (not polled for > 5 minutes):** Degraded. Confidence score reflects reduced certainty. Physical screen content unknown. Operator visibility through Screen Resolution Map.

**Emergency activation latency exceeding 5 seconds at p99:** Degraded. The 5-second SLA (ENGINEERING-CONSTITUTION-v1.md §23.1, §26.3) is a constitutional constraint. Exceeding it is a P1 incident. Not catastrophic because the emergency activates eventually and the synchronous cache bust eventually occurs.

### 13.4 Catastrophic Failures

The following failure modes are catastrophic. They MUST NOT occur. They represent fundamental violations of the platform's correctness guarantees:

**Nondeterministic playback:** PRE producing different output for identical `(screen_id, at, SystemState)` inputs. This destroys the proof-of-play guarantee, the replay capability, and all audit claims. Invariant violation: INV-3.

**Unverifiable playback:** A manifest is delivered to a screen but cannot be reconstructed from the audit log and PRE replay. This destroys the platform's compliance capability. Occurs if audit events are missing for state mutations that contributed to the manifest.

**Silent divergence:** PRE produces output that differs from what would be computed from the audit log's record of SystemState, without any observable signal indicating the divergence. This is the worst failure mode: the platform appears to be functioning while producing unverifiable results.

**Automatic corrective behavior:** The system modifies operator-configured state without explicit operator initiation. This destroys the contract of operator agency and makes the system's behavior non-deterministic from the operator's perspective.

**Emergency check bypass:** PRE produces output without evaluating emergency state first. INV-7 violation. Emergency content obligations are a safety and legal matter.

**Version decrement:** A version counter for a screen decreases. This invalidates all cache coherency guarantees and proof-of-play claims that rely on version monotonicity. INV-4 violation.

**Client-side resolution:** Any system other than PRE (frontend, Pi appliance firmware, offline cache) implements content selection or playlist ordering logic. This creates unauditable dual-authority over playback. Prohibited by FP-14.

### 13.5 Graceful Degradation Hierarchy

When failures occur, the system degrades through a defined hierarchy in which each level is preferable to the next:

```
LEVEL 1 — Current manifest from PRE (nominal; all invariants hold)
  ↓
LEVEL 2 — Cached manifest (within valid_until; marked as cached; version preserved)
  ↓
LEVEL 3 — Stale cached manifest (within MAX_STALE_AGE; marked as stale; degraded indicator)
  ↓
LEVEL 4 — System Fallback (database unavailable or stale age exceeded; is_fallback = true)
```

No level below Level 4 exists. The System Fallback is the terminal fallback state. If the System Fallback cannot be delivered (application process failure), the screen continues playing its last-received manifest from its local cache, which the Pi appliance MUST retain and MUST NOT modify (ENGINEERING-CONSTITUTION-v1.md §22.3).

### 13.6 Constitutional Breach Classification

Any failure that violates an invariant from INV-1 through INV-10 or a prohibition from FP-01 through FP-15 is classified as a CONSTITUTIONAL_BREACH at the CATASTROPHIC severity level. Constitutional breaches:

- Trigger immediate P0 incident response.
- Require root cause analysis completed within 24 hours.
- Require a documented correction plan within 48 hours.
- MAY require constitutional amendment if the breach reveals a flaw in the constitutional rules themselves.

Constitutional breaches MUST NOT be silently resolved through operational workarounds. The fix MUST address the root cause. If the root cause requires emergency amendment of the constitution (per §30.4), that process MUST be initiated within the incident window.

---

## 14. Replay Corpus Governance

### 14.1 Corpus Purpose and Permanence

The replay corpus is the set of all committed replay packets (Section 3.2) that represent ground truth for PRE behavioral correctness. It is the primary mechanism by which PRE implementation changes are verified not to alter behavioral outputs.

**The replay corpus is permanent. No replay vector is ever deleted.**

When a corpus entry becomes obsolete — because the behavioral change it represents was intentional and constitutionally valid — the entry is **archived with documentation**, not deleted. Archived entries remain in the corpus store. They are excluded from the active regression gate but retained as historical record.

### 14.2 Corpus Structure

The replay corpus is organized into four categories:

**Golden Vectors:** Manually constructed replay packets representing critical behavioral scenarios. At minimum, one golden vector MUST exist for each of the following:

- LEVEL_0 emergency termination (with emergency content present)
- LEVEL_0 emergency termination (emergency content absent; SYSTEM_EMERGENCY_FALLBACK)
- LEVEL_1 operational override (screen-targeted)
- LEVEL_1 operational override (area-targeted; screens not targeted by more specific override)
- LEVEL_2 scheduled override (replacement type)
- LEVEL_2 suppression override (campaign layer continues after suppression)
- LEVEL_3 campaign resolution (single campaign, single schedule)
- LEVEL_3 campaign resolution (multiple specificity levels; higher specificity wins)
- LEVEL_3 with LEVEL_4 sponsorship injection (SOV < MAX_SPONSOR_CAPACITY)
- LEVEL_3 with LEVEL_4 sponsorship at saturation (SOV >= MAX_SPONSOR_CAPACITY; proportional reduction)
- LEVEL_5 structural fallback (area-level fallback schedules)
- LEVEL_5 System Fallback (no schedulable content anywhere in hierarchy)
- DST spring-forward gap (schedule in gap produces no match)
- DST fall-back overlap (schedule matches both occurrences of ambiguous hour)
- Midnight-crossing schedule with day-of-week constraint
- All 14 edge cases (EC-1 through EC-14) from PRE-REFERENCE-IMPLEMENTATION-v1.md §24

**Edge-Case Corpus:** Replay packets generated by the property test framework's shrink algorithm (Section 4.9). Every failing property test that is resolved produces one new edge-case corpus entry representing the minimal failing case. Edge-case corpus entries are added automatically by the property test harness.

**Production Incident Captures:** Replay packets captured from production traffic when an incident involves unexpected PRE behavior. These are manually reviewed, annotated, and committed to the corpus. Every production incident that involves PRE output becomes a permanent corpus entry.

**Production Samples:** A statistical sample of production PRE invocations captured automatically during normal operation, used to verify that the replay harness produces correct results against real-world SystemState complexity.

### 14.3 Corpus Retirement Process

When a PRE implementation change is intentionally altering behavior — a bug fix, a specification correction, a constitutionally-amended behavioral change — corpus entries that capture the now-incorrect previous behavior must be archived:

1. Identify all corpus entries that fail against the new implementation.
2. For each failing entry: verify that the failure is expected given the intended behavioral change.
3. For each verified entry: create a retirement record documenting: the packet_id, the original behavior, the new behavior, the reason for the change (bug fix, spec correction, or amendment reference), and the date of retirement.
4. Move the packet to the `archived/` section of the corpus store.
5. Create a new replacement corpus entry capturing the correct behavior under the new implementation.
6. Verify that all replacement entries pass against the new implementation.
7. Merge.

The retirement record is permanent. The archived entry is permanent. No information is lost.

### 14.4 Production Incidents as Corpus Entries

Every production incident involving unexpected PRE output MUST result in a replay corpus entry:

1. At incident detection: capture the SystemState snapshot and the unexpected PRE output as an incident replay packet.
2. During incident investigation: verify that the replay harness reproduces the unexpected behavior, or identify why it does not (which would itself indicate a replay system gap).
3. Post-resolution: capture a second replay packet representing the correct behavior in the same SystemState.
4. Commit both packets: the incident capture (annotated with incident ID) and the corrected behavior capture.

This discipline ensures that every production incident contributes to the corpus. The corpus reflects the full history of PRE behavior, including incidents. No incident is lost to time.

### 14.5 Corpus Integrity Verification

The corpus store MUST be backed up daily. The backup MUST include a cryptographic integrity verification of the full corpus (SHA-256 hash of canonical serialization of all active packet checksums). Any backup that fails integrity verification is itself a CONSTITUTIONAL_BREACH alert.

The corpus size MUST increase monotonically. A replay audit that shows corpus size smaller than the prior audit's corpus size (absent documented archival) is an integrity failure requiring investigation.

---

## 15. Future Extraction Safety

### 15.1 Current Architecture Constraint

The current ClubHub TV platform is a modular monolith. Service extraction to separate network processes MUST NOT be performed until a service is demonstrably constrained by co-location (ENGINEERING-CONSTITUTION-v1.md §27.1). When extraction occurs, the module boundary becomes a network boundary. No additional logic MUST be added during extraction. Extraction is a structural change, not a feature opportunity.

This section defines the constraints that any future extraction MUST satisfy to preserve the replay, determinism, and verification guarantees.

### 15.2 Replay Compatibility During Service Extraction

**Extraction MUST NOT alter PRE outputs.** This is the non-negotiable constraint on any future extraction event.

Before any PRE extraction, the following MUST be verified:

1. The full replay corpus passes against the pre-extraction implementation.
2. After extraction, the full replay corpus passes against the post-extraction implementation with identical pass rates.
3. Any corpus entry that fails post-extraction triggers a full stop until the regression is resolved.
4. Performance characteristics of the extraction do not cause time-sensitive behaviors (cache invalidation timing, emergency activation latency) to regress below constitutional thresholds.

The extraction event MUST be documented in a Extraction Compatibility Report that records: corpus pass rate before and after, performance benchmark comparison, any constitutional invariants that required implementation changes to accommodate the network boundary.

### 15.3 Distributed Determinism Constraints

When PRE is extracted as a standalone service, several determinism constraints must be actively maintained:

**Single PRE invocation per request:** The Manifest Delivery System MUST call exactly one PRE instance per manifest request. Load balancing across multiple PRE instances is permitted only if determinism is preserved — identical inputs MUST produce identical outputs regardless of which instance handles the request.

**Shared database read:** All PRE instances in a distributed deployment MUST read from the same PostgreSQL primary (or from a replica whose lag does not exceed the `valid_until` horizon of the most recently served manifest). PRE instances MUST NOT diverge due to replica lag causing different SystemState reads for concurrent requests.

**Version counter centrality:** The `screen_versions` table MUST remain on a single authoritative write node. Version counter increments MUST use compare-and-swap semantics (ENGINEERING-CONSTITUTION-v1.md §16.2). Concurrent version increments from multiple PRE instances MUST be serialized through the database's atomic update guarantees.

**Emergency check synchrony:** Emergency state must be readable by all PRE instances with sub-poll-interval freshness. The 5-second emergency activation SLA (ENGINEERING-CONSTITUTION-v1.md §23.1) MUST be maintained end-to-end even in a distributed deployment.

### 15.4 Checksum Stability During Horizontal Scaling

The FNV-1a 32-bit checksum algorithm (PRE-REFERENCE-IMPLEMENTATION-v1.md §18.1) MUST produce identical results across all PRE instances in a horizontally scaled deployment. This requires:

- Identical implementation of `canonicalizeJson` across all instances (same key ordering, same null handling, same numeric formatting).
- Identical constant values for `FNV1A_OFFSET_BASIS`, `FNV1A_PRIME`, `FNV1A_MOD`.
- No locale-dependent string operations in the serialization path.
- Identical UTF-8 encoding throughout.

Checksum stability verification MUST be part of the Extraction Compatibility Report: the same SystemState MUST produce the same checksum regardless of which PRE instance processes the request.

### 15.5 Service Decomposition Must Preserve Replay Equivalence

**This is the highest constraint on service decomposition.** Any decomposition that changes PRE outputs — even in cases where the changed output is semantically equivalent from a content-delivery perspective — violates replay equivalence and requires corpus retirement procedures (Section 14.3) plus a formal constitutional review.

The test of replay equivalence is mechanical and binary: run the full replay corpus against the post-extraction deployment. If pass rate is 100%, extraction is valid. If pass rate is less than 100%, the extraction is non-conformant until the cause is investigated and resolved.

There are no exceptions to this requirement. Partial replay equivalence ("the failures are corner cases that don't occur in production") is not accepted. The corpus represents exactly the set of behaviors that have been committed to as permanent. Any departure from committed behavior, however minor, requires formal disposition.

---

## 16. Appendix: Verification Matrix

This matrix maps constitutional invariants to the verification systems, observability signals, chaos tests, entropy metrics, and replay coverage that collectively prove each guarantee. A guarantee that is not covered by at least one item in each column is a gap that MUST be addressed.

### 16.1 PRE Invariant Coverage

| Invariant | Layer 1 (Unit) | Layer 2 (Property) | Layer 3 (Replay) | Layer 4 (Contract) | Layer 8 (Production) | Chaos Coverage |
|-----------|------------|----------|-------|----------|------------|---------|
| INV-1 Purity | FP-02 detection | Purity property (side effect intercept) | Replay harness isolation | Static analysis FP-02 | Audit write failures counter | §6.5 cache loss |
| INV-2 Totality | Null return tests | All-inputs return test | Replay harness null check | — | `manifest_errors_total` | §6.3, §6.4, §6.5 |
| INV-3 Determinism | Identical-input double-call test | Double-call property | Replay checksum gate | — | — | §6.5, §6.9 |
| INV-4 Monotone Versioning | Version increment test | Version sequence property | — | FP-09 detection | `version_counter_per_screen` | §6.5 |
| INV-5 Level Termination | Level-termination fixture tests | Termination property | Golden vectors per level | — | `pre_resolution_level_dist` | §6.7 |
| INV-6 No Content Amplification | Content-set containment test | Containment property | All golden vectors | — | — | §6.2 |
| INV-7 Emergency Absoluteness | Emergency fixture tests | Emergency property | Emergency golden vectors | FP-11 detection | `emergency_active_count` | §6.3 with emergency pre-activated |
| INV-8 Sponsorship Non-Penetration | Level 0/1 fixture tests | Sponsorship skip property | Level 0/1 golden vectors | — | `pre_resolution_level_dist` + `content_mix` | — |
| INV-9 Timezone Isolation | DST fixture tests | DST transition property | DST golden vectors | FP-10 detection | — | §6.8 clock skew |
| INV-10 Output Completeness | reason_trace coverage test | Completeness property | All golden vectors | — | — | — |

### 16.2 Forbidden Pattern Coverage

| Pattern | Static Analysis | CI Gate | Production Monitor | Severity |
|---------|----------------|---------|-------------------|---------|
| FP-01 Duplicate Resolution Logic | Yes — module boundary check | CONSTITUTIONAL_BREACH | — | CONSTITUTIONAL_BREACH |
| FP-02 Side Effects in PRE | Yes | CONSTITUTIONAL_BREACH | Purity gate dynamic check | CONSTITUTIONAL_BREACH |
| FP-04 Poll Path Mutation | Yes — write call detection | CONSTITUTIONAL_BREACH | — | CONSTITUTIONAL_BREACH |
| FP-06 Auto Corrective Behavior | Yes — mutation trigger check | CONSTITUTIONAL_BREACH | — | CONSTITUTIONAL_BREACH |
| FP-07 Hardcoded Thresholds | Yes — literal threshold detection | ERROR | — | ERROR |
| FP-09 Version Counter Reset | — | — | `version_counter_per_screen` monotonicity | CONSTITUTIONAL_BREACH |
| FP-10 Timezone Ambiguity | Yes — Date() call detection | CONSTITUTIONAL_BREACH | — | CONSTITUTIONAL_BREACH |
| FP-14 Frontend Authority | Code review (not automated) | — | — | CONSTITUTIONAL_BREACH |
| FP-15 Unversioned Cache Invalidation | Yes — TTL-only invalidation | ERROR | — | ERROR |

### 16.3 Entropy Metric Coverage

| Metric | Detection Layer | Verification System | Review Workflow | Entropy Score Weight |
|--------|----------------|-------------------|----------------|---------------------|
| M-01 Override Divergence | Layer 7 | P-4 Area Reality Check | Weekly Review | 25% |
| M-02 Override Age | Layer 7 | Stale Config Dashboard | Weekly Review | (feeds M-11) |
| M-03 Campaign Coverage | Layer 7 | P-2 Campaign Delivery Preview | Weekly Review | 20% |
| M-04 Priority Range | Layer 7 | Stale Config Dashboard | Weekly Review | 15% |
| M-05 Duplicate Content Pairs | Layer 7 | P-3 Override Impact Preview | Weekly Review | (advisory) |
| M-06 SOV Warning Duration | Layer 7 | Venue Health Dashboard | Weekly Review | 15% |
| M-07 Editorial Content Rate | Layer 7 | Venue Health Dashboard | Weekly Review | (advisory) |
| M-08 Emergency Activation Rate | Layer 7 | Emergency Activation Log | Post-Incident Review | 10% |
| M-09 Emergency Reason Completion | Layer 7 | Emergency Activation Log | Post-Incident Review | (advisory) |
| M-10 Orphaned Schedule Count | Layer 7 | Stale Config Dashboard | Weekly Review | (advisory) |
| M-11 Override-as-Schedule Count | Layer 7 | Stale Config Dashboard | Weekly Review | 10% |
| M-12 Screen Config Staleness | Layer 7 (Staleness Index) | Stale Config Dashboard | Weekly Review | 5% |

### 16.4 Chaos Test to Guarantee Coverage

| Chaos Scenario | Invariants Verified | Graceful Degradation Verified | Production Metric Affected |
|----------------|--------------------|-----------------------------|--------------------------|
| §6.2 Backend Restart | INV-3, INV-2 | Cache miss recovery within 120s | `manifest_cache_hit_ratio` |
| §6.3 Database Restart | INV-2, INV-4 | Stale cache → System Fallback transition | `manifest_errors_total`, `is_fallback` rate |
| §6.4 Network Partition | INV-2, INV-4 | Identical to §6.3 | Same as §6.3 |
| §6.5 Cache Loss | INV-3, INV-4 | Recomputation from DB | `manifest_cache_hit_ratio` |
| §6.6 Stale Manifest Recovery | INV-3, INV-2 | Reconnection recomputation | `screen_poll_success_rate` |
| §6.7 Event Bus Lag | INV-4, INV-3 | Bounded invalidation delay | `shadow_divergence_total` |
| §6.8 Clock Skew | INV-9 | No impact on PRE output | — |
| §6.9 Poll Storm | INV-3, INV-2 | p95 latency within 500ms | `manifest_compute_duration_ms` |

### 16.5 Replay Corpus to Specification Coverage

| Specification Section | Required Golden Vector | Corpus Category |
|-----------------------|----------------------|----------------|
| §6 Resolution Algorithm, LEVEL_0 | Emergency termination with content | Golden |
| §21.7 Emergency with missing content | SYSTEM_EMERGENCY_FALLBACK | Golden |
| §6 LEVEL_1 | Operational override, screen-targeted | Golden |
| §6 LEVEL_2 | Scheduled override, replacement | Golden |
| §10 Suppression | Suppression override, campaign continues | Golden |
| §11 Sponsorship | SOV injection at and above capacity | Golden |
| §17 Fallback Hierarchy | Each of 4 fallback tiers | Golden |
| §8 DST | Spring-forward gap, fall-back overlap | Golden |
| §7.3 Midnight Crossing | Day-of-week + midnight crossing | Golden |
| §24 EC-1 through EC-14 | All 14 edge cases | Golden |
| Property test failures | All shrunk minimal failures | Edge-Case Corpus |
| Production incidents | All PRE-related incidents | Incident Captures |

---

## 17. Appendix: Severity Classification Matrix

### 17.1 Classification Definitions

The following severity levels apply to all signals, alerts, advisory messages, and constitutional enforcement outputs across the ClubHub TV platform. Every observable failure signal MUST be assigned exactly one severity level.

---

**INFO**

A normal operational event that is recorded for audit trail and operational visibility. No operator action required. No metric threshold crossed.

Examples: Manifest computed successfully; override created by operator; campaign published; entropy computation completed; schedule expired normally.

Escalation behavior: None. Retained in structured logs per retention policy.
Operator visibility: Available in logs and dashboards on demand; not surfaced proactively.
Deploy gating: None.

---

**ADVISORY**

An operational signal that warrants operator awareness. A metric is approaching or has crossed an advisory threshold. An entropy score has increased week-over-week. A configuration row has become stale by Class A classification.

Examples: M-01 Override Divergence Rate crossing 15%; Entropy Score crossing from Nominal into Drifting; override age exceeding 30 days; SOV warning duration exceeding 7 days.

Escalation behavior: Surfaced as Tier 1 or Tier 2 advisory in operator-facing UX (see Section 11.3). Logged as `level: ADVISORY` in structured log.
Operator visibility: Ambient (Tier 1) or requires acknowledgment (Tier 2). Does not page on-call.
Deploy gating: None.

---

**WARNING**

A system-level signal that indicates a condition requiring investigation within a defined timeframe. A metric has crossed a REVIEW threshold. A migration file is missing a required rollback comment. A chaos test has produced an expected degradation that is approaching tolerance boundaries.

Examples: M-01 Override Divergence Rate crossing 30%; Entropy Score reaching Degraded range (61–80); migration file lacking rollback procedure; p95 PRE latency trending toward 200ms budget.

Escalation behavior: Logged as `level: WARNING`. Creates a tracked work item for the next sprint cycle. Does not block current deploys.
Operator visibility: Surfaced in daily operational review. Venue-level warnings surfaced in Venue Health Dashboard.
Deploy gating: Migration warnings block deploy. Metric warnings do not block deploy but are reviewed before advancing canary steps.

---

**ERROR**

A verification system failure that is not a constitutional invariant violation but indicates incorrect system behavior. A replay packet fails against the current implementation. A forbidden pattern (non-constitutional) is detected. A chaos test invariant assertion fails under an injected failure condition.

Examples: Replay regression (corpus packet produces different output with current implementation); FP-07 hardcoded threshold detected; FP-15 unversioned cache invalidation detected; chaos test asserts unexpected failure mode.

Escalation behavior: Blocks merge (if detected in CI). Pages on-call if detected in production (30-minute SLA for investigation start).
Operator visibility: Visible in CI results, engineering dashboards. Not surfaced in venue-operator UX.
Deploy gating: Merge-blocking. Not deployment-blocking unless detected post-deploy.

---

**CONSTITUTIONAL_BREACH**

A violation of a PRE invariant (INV-1 through INV-10), a forbidden pattern (FP-01 through FP-15), or a forbidden state (FORBIDDEN-1 through FORBIDDEN-10). This is the highest engineering severity level below CATASTROPHIC.

Examples: FP-02 side effect detected in PRE; FP-06 automatic corrective behavior detected; FORBIDDEN-1 two active emergencies per venue; replay corpus integrity check failure; version counter decrement detected; emergency check bypass.

Escalation behavior: Immediate P0 incident created. On-call paged within 60 seconds. Root cause analysis required within 24 hours. Documented correction plan within 48 hours. Constitutional amendment process initiated if required.
Operator visibility: P0 incident channel; status page update for any operator-visible impact.
Deploy gating: Blocks all deploys until resolved or emergency bypass documented (Section 10.7).

---

**CATASTROPHIC**

A failure that has destroyed a fundamental platform guarantee: nondeterministic playback, unverifiable manifests, silent divergence, automatic corrective behavior that has modified operator configuration without authorization, client-side resolution discovered in production.

CATASTROPHIC failures are the enumerated failure modes from Section 13.4. They are distinguished from CONSTITUTIONAL_BREACH by the scope of their impact: where a CONSTITUTIONAL_BREACH is a violation of a rule, CATASTROPHIC is the realization of the failure the rule was designed to prevent.

Escalation behavior: All-hands P0. Executive notification. Full platform audit initiated within 24 hours. No deploys until root cause confirmed resolved. Incident retrospective mandatory within 5 business days. Regulatory notification assessed (proof-of-play contract impact).
Operator visibility: Status page major incident. Venue operators notified of any proof-of-play impact.
Deploy gating: Complete deploy freeze until incident resolved and root cause confirmed.

### 17.2 Severity Escalation Paths

```
INFO → (threshold crossing) → ADVISORY
ADVISORY → (review threshold) → WARNING
WARNING → (invariant violation) → CONSTITUTIONAL_BREACH
CONSTITUTIONAL_BREACH → (guarantee destroyed) → CATASTROPHIC

Error is a lateral classification:
ERROR ↔ (invariant implications) → CONSTITUTIONAL_BREACH
```

No automatic de-escalation. Severity may only decrease when the underlying condition is confirmed resolved through explicit verification, not through timeout or absence of further signals.

### 17.3 On-Call Paging Thresholds

| Severity | Page Timing | SLA |
|----------|-------------|-----|
| INFO | Never | — |
| ADVISORY | Never | — |
| WARNING | Never (creates work item) | Next sprint |
| ERROR | 30 minutes after detection | Investigation starts within 30 min |
| CONSTITUTIONAL_BREACH | Within 60 seconds | P0 incident; active investigation immediately |
| CATASTROPHIC | Within 60 seconds | All-hands; deploy freeze immediately |

---

*Document status: Ratified. This document governs the verification, simulation, observability, entropy-detection, and operational-safety architecture for ClubHub TV permanently. Amendments require the constitutional amendment process defined in ENGINEERING-CONSTITUTION-v1.md §30.*
