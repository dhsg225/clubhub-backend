# REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md
# ClubHub TV — Canonical State Fixtures, Replay Vectors, and Behavioral Reference Corpus

**Document type:** Canonical governance specification — permanent behavioral anchor
**Status:** Ratified
**Date:** 2026-05-20
**Authority:** Implements VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §3 and §14; coordinates with ENGINEERING-CONSTITUTION-v1.md §15, §25; PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B; IMPLEMENTATION-ROADMAP-v1.md
**Superseded by:** Constitutional amendment only (per ENGINEERING-CONSTITUTION-v1.md §30)

---

## Normative Language

Key words carry the same meanings as defined in ENGINEERING-CONSTITUTION-v1.md §0:

- **MUST** — Absolute requirement. Violation is a defect.
- **MUST NOT** — Absolute prohibition.
- **SHALL** — Synonym for MUST.
- **SHOULD** — Strong recommendation. Deviation requires documented justification.
- **MAY** — Permitted. Not required.

---

## Table of Contents

1. [Purpose of the Canonical Corpus](#1-purpose-of-the-canonical-corpus)
2. [Canonical Fixture Taxonomy](#2-canonical-fixture-taxonomy)
3. [Replay Packet Canonical Form](#3-replay-packet-canonical-form)
4. [Golden Manifest Corpus](#4-golden-manifest-corpus)
5. [Edge-Case Corpus](#5-edge-case-corpus)
6. [Chaos Fixture Corpus](#6-chaos-fixture-corpus)
7. [Entropy Fixture Corpus](#7-entropy-fixture-corpus)
8. [Historical Incident Replay Archive](#8-historical-incident-replay-archive)
9. [Cross-Version Equivalence Rules](#9-cross-version-equivalence-rules)
10. [Fixture Mutation Governance](#10-fixture-mutation-governance)
11. [Corpus Storage Architecture](#11-corpus-storage-architecture)
12. [Replay Determinism Constraints](#12-replay-determinism-constraints)
13. [Human Review Workflow](#13-human-review-workflow)
14. [Future Extraction and Distribution Safety](#14-future-extraction-and-distribution-safety)
15. [Corpus Longevity Rules](#15-corpus-longevity-rules)
16. [Appendix A — Minimum Mandatory Golden Fixtures](#16-appendix-a--minimum-mandatory-golden-fixtures)
17. [Appendix B — Replay Packet Schema](#17-appendix-b--replay-packet-schema)
18. [Appendix C — Forbidden Replay Divergence Types](#18-appendix-c--forbidden-replay-divergence-types)

---

## 1. Purpose of the Canonical Corpus

### 1.1 The Central Claim

The ClubHub TV platform makes an auditable promise: for any screen at any point in time, the system can prove what was playing and why. This promise is not fulfilled by a passing test suite. It is not fulfilled by a monitoring dashboard. It is fulfilled by a permanent, immutable record of behavioral truth — a corpus of canonical inputs with canonical outputs, against which every past, present, and future implementation of the Playback Resolution Engine (PRE) is continuously measured.

The canonical corpus is that record. It is the behavioral anchor against which implementations are verified, not the other way around. Implementations change. Runtimes are upgraded. Languages are replaced. Services are extracted. The corpus outlasts all of them.

### 1.2 Why Replay Vectors Exist

A replay vector is a sealed record: a fully-specified input state, an evaluation timestamp, and the exact output that a correct PRE implementation MUST produce for those inputs. Replay vectors exist because:

**Determinism must be proved, not assumed.** Any change to the PRE implementation — however minor — may alter its outputs in ways that are invisible without a comprehensive behavioral anchor. A replay vector proves that the current implementation produces the same output as all prior implementations for the same inputs. Without replay vectors, implementation correctness is asserted; with them, it is demonstrated.

**Regression prevention is permanent.** An edge case discovered in 2026 becomes a replay vector. In 2031, a new engineer modifies the DST evaluation logic to fix a different bug. The 2026 edge case replay vector catches the regression before it reaches production. The engineer in 2031 may not know the 2026 case exists — that is the point. The corpus knows.

**Incident resolution requires historical grounding.** When an operator files a complaint about incorrect content on screen X at time T, the replay vector for that incident — captured at the time of the incident — is the authoritative record of what PRE should have produced. The live system's current state is irrelevant to answering a historical question. The corpus answers it.

### 1.3 Why Fixtures Are Constitutional Infrastructure

ENGINEERING-CONSTITUTION-v1.md §15.1 requires that PRE computation be replayable for any screen at any past timestamp within the audit retention window. ENGINEERING-CONSTITUTION-v1.md §25.2 requires that all PRE test inputs be committed, deterministic, and reviewed fixtures — not generated at test runtime from live state. VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §3 formalizes the replay harness specification.

Fixtures are the operationalization of these constitutional requirements. They are not test data. They are not sample inputs. They are the permanent behavioral specification of PRE in executed form: sealed records of what correct behavior looks like for specific inputs, with the same standing as the PRE-REFERENCE-IMPLEMENTATION-v1.md specification itself.

A constitutional requirement to maintain replayability is empty without a corpus of replay vectors to replay. A constitutional requirement for determinism is untestable without committed, stable inputs against which determinism is verified. Fixtures are what make constitutional requirements concrete and verifiable.

### 1.4 Why Determinism Requires Immutable Anchors

Determinism is the property that identical inputs produce identical outputs. To verify determinism across time — across implementation changes, runtime upgrades, and service extractions — the inputs must be immutable. If a fixture's input state is allowed to evolve, the comparison it enables is no longer against the original behavior but against a moving target.

Immutable anchors make the following claim verifiable: the PRE implementation that runs today, given the exact same input state that ran in 2026, produces the exact same output. This claim is the replay guarantee. Without immutable inputs, the claim cannot be verified. With immutable inputs, it can be verified mechanically on every build.

No fixture in the canonical corpus may be modified after ratification. Modifications would invalidate the replay guarantee for any period during which the fixture was in use. If the behavior a fixture captures is no longer correct — because a constitutional bug fix altered PRE semantics — the fixture is archived (with documentation) and a replacement fixture is added. The archive is permanent. The original fixture is never deleted.

### 1.5 Why Production Incidents Become Permanent Fixtures

A production incident involving unexpected PRE behavior is a discovered edge of the specification — a scenario that the specification authors did not anticipate explicitly, or a scenario in which the implementation diverged from the specification. Both cases are valuable.

When a production incident is resolved, the resolution leaves two artifacts in the corpus:

1. **The incident capture:** The exact input state and the incorrect output the system produced. This is archived with incident annotation. It proves what happened.

2. **The corrected behavior fixture:** The exact input state and the correct output a conforming implementation must produce. This becomes an active corpus entry and blocks future regressions.

If the same input state had been a corpus entry before the incident, the CI replay gate would have caught the regression before it reached production. The incident transforms the unknown edge case into a known, guarded one. Every incident the corpus captures is a regression that cannot recur silently.

### 1.6 Fixtures Are Behavioral Truth; Implementations Are Replaceable

This ordering is not rhetorical. It has operational consequences.

When the replay harness detects a divergence between a current implementation and a corpus fixture, the investigation begins with the assumption that the implementation is wrong and the fixture is right. If that assumption is overturned — if the fixture captures behavior that was itself a bug — the fixture is retired through the documented retirement process. But the starting posture is that the corpus is the authority.

An implementation that passes all corpus fixtures is correct by definition. An implementation that fails any corpus fixture is incorrect until demonstrated otherwise. There is no third category.

The practical implication: it is possible and desirable to replace the PRE implementation entirely — in a different language, with a different data structure strategy, with a different optimization approach — and have the new implementation be considered correct the moment it passes 100% of the corpus. The corpus is the specification in executable form.

---

## 2. Canonical Fixture Taxonomy

### 2.1 Overview

The canonical corpus is organized into eight fixture classes. Each class has a distinct purpose, retention policy, and governance rule. All classes share two properties that are non-negotiable:

- Fixtures are append-only. Once ratified, a fixture is never modified.
- Fixtures are never silently modified. Any change to a ratified fixture is a mutation event requiring the full retirement-and-replacement process (Section 10).

### 2.2 Golden Fixtures

**Purpose:** Prove that PRE produces correct output for the canonical behavioral scenarios defined by the resolution algorithm. Golden fixtures are the minimum set required to demonstrate that an implementation is conformant with the PRE specification.

**What each proves:** Correct execution of a specific resolution path — a specific combination of resolution level, specificity, content mix, and reason_trace structure. Golden fixtures are constructed from PRE-REFERENCE-IMPLEMENTATION-v1.md's formal algorithm specification.

**Retention policy:** Permanent and active. Golden fixtures are never archived unless the underlying behavioral specification changes through constitutional amendment. If a spec change causes a golden fixture to represent incorrect behavior, the fixture is archived and replaced.

**Mutation rules:** MUST NOT be modified after ratification. MUST NOT be archived without a constitutional amendment documenting the behavioral change and a replacement fixture capturing the new correct behavior.

**Minimum required set:** Defined in Appendix A.

### 2.3 Edge-Case Fixtures

**Purpose:** Prove that PRE handles the boundary conditions and formally-specified edge cases (EC-1 through EC-14 in PRE-REFERENCE-IMPLEMENTATION-v1.md §24) correctly. Edge-case fixtures are generated either by systematic coverage of the specification's edge-case enumeration, or by the shrink algorithm of the property test framework (VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §4.9).

**What each proves:** Correct handling of a specific edge condition that normal operational inputs would rarely or never exercise: DST transitions, midnight-crossing schedules, exact-boundary timestamps, simultaneous-issue overrides, zero-duration items, and so on.

**Retention policy:** Permanent and active. Edge-case fixtures remain active indefinitely. If a DST-related edge case discovered in 2026 is still in the corpus in 2031, that is correct — the DST behavior has not changed and the fixture continues to guard against regression.

**Mutation rules:** MUST NOT be modified. A failing edge-case fixture MUST be investigated, not deleted.

**Addition mechanism:** Automatically added by property test framework on shrink completion (VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §4.9), or manually added by engineers who identify edge conditions not covered by the shrink process.

### 2.4 Failure-State Fixtures

**Purpose:** Prove that PRE produces the correct System Fallback or degraded output when input state is pathological: missing content references, invalid timezone strings, campaigns with no content items, emergency states with missing content, screens with status `unprovisioned`.

**What each proves:** Correct execution of the failure semantics defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §21 (failure conditions) and §17 (fallback hierarchy). Specifically: PRE MUST NOT throw; PRE MUST produce a valid `PRE_Output` containing a non-empty `active_playlist` even when all content resolution paths are exhausted.

**Retention policy:** Permanent and active.

**Mutation rules:** MUST NOT be modified. Failure-state fixtures capture behaviors that must remain stable across implementation changes — the System Fallback content is a compile-time constant, so any fixture that expects the System Fallback expects a specific, permanently-defined output.

### 2.5 Entropy Fixtures

**Purpose:** Prove that the entropy detection system (VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §7; OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md) produces correct metric values and advisory signals for known configuration states. Entropy fixtures are SystemState snapshots with known M-01 through M-12 metric values.

**What each proves:** That the entropy computation layer correctly derives metric values from configuration state. Entropy fixtures are not PRE replay fixtures — they do not capture PRE output. They capture the relationship between a `SystemState` and the entropy metrics that state produces.

**Retention policy:** Permanent and active for baseline fixtures. Entropy progression sequence fixtures (Section 7) retain all steps in the sequence permanently.

**Mutation rules:** MUST NOT be modified. The relationship between a specific configuration state and the entropy metrics it produces is deterministic — if the metrics computation logic changes, all entropy fixtures must be re-validated.

### 2.6 Chaos Fixtures

**Purpose:** Prove that graceful degradation behaviors are consistent and reproducible across the failure scenarios defined in VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §6. Chaos fixtures define the expected system behavior under injected failure conditions.

**What each proves:** Not PRE correctness (PRE is not invoked in some chaos scenarios) but system-level degradation correctness: stale cache is served within MAX_STALE_AGE, System Fallback activates after that window, invariants are preserved during partial failures.

**Retention policy:** Permanent and active.

**Mutation rules:** MUST NOT be modified. If the acceptable degradation behavior changes (e.g., MAX_STALE_AGE is increased), the affected chaos fixtures must be retired and replaced with fixtures reflecting the new thresholds.

### 2.7 Historical Regression Fixtures

**Purpose:** Capture the exact input state and expected correct output for every production incident involving PRE behavior divergence. Historical regression fixtures are the production-incident counterpart to golden fixtures — they represent edge cases that the specification did not anticipate explicitly, discovered through real operational use.

**What each proves:** That the specific incorrect behavior observed in the incident does not recur for any future implementation. Historical regression fixtures are anti-regression anchors for past failures.

**Retention policy:** Permanent. Historical regression fixtures are never archived. They accumulate monotonically. Even if the specific incident scenario is considered extremely unlikely to recur, the fixture remains active because its value is regression prevention, not scenario frequency.

**Mutation rules:** MUST NOT be modified. Historical regression fixtures are sealed at the time of incident resolution and are not subsequently altered.

### 2.8 Cross-Version Compatibility Fixtures

**Purpose:** Capture PRE output at specific points in the implementation's evolution, enabling verification that a new implementation produces identical outputs to the implementation it replaces. Cross-version compatibility fixtures are captured at constitutional milestones: Phase 2 shadow mode baseline, Phase 5 cutover baseline, and any subsequent implementation-level revision.

**What each proves:** That behavioral equivalence is preserved across implementation generations. These fixtures are the primary tool for verifying service extraction safety (Section 14).

**Retention policy:** Permanent. Each version baseline is retained indefinitely, enabling any future implementation to verify compatibility with any past version's behavioral record.

**Mutation rules:** MUST NOT be modified. Cross-version fixtures are sealed at the milestone that produces them.

### 2.9 Fixture Immutability Summary

| Class | Active | Archived on | Deleted | Adds automatically |
|-------|--------|-------------|---------|-------------------|
| Golden | Yes | Constitutional amendment | Never | No |
| Edge-Case | Yes | Constitutional amendment | Never | Property test shrink |
| Failure-State | Yes | Constitutional amendment | Never | No |
| Entropy | Yes | Metric computation change | Never | No |
| Chaos | Yes | Threshold change | Never | No |
| Historical Regression | Yes | Never | Never | Incident capture |
| Cross-Version Compat. | Yes (by version) | Never | Never | Milestone capture |

---

## 3. Replay Packet Canonical Form

### 3.1 The Replay Packet as the Unit of Behavioral Truth

A replay packet is the atomic unit of the canonical corpus. It seals together an input state and its expected output, with sufficient metadata to identify, index, version, and verify it across arbitrarily long time horizons.

Every replay packet is immutable after creation. Its fields are determined at capture time and do not change. No replay packet may be updated in place. If the captured behavior needs revision, the original packet is archived and a new packet is created.

### 3.2 Canonical Packet Structure

The full canonical replay packet schema is defined in Appendix B. The top-level structure is:

```
TYPE ReplayPacket = {
  // Identity
  packet_id        : STRING (UUID v4; assigned at capture time; immutable forever)
  packet_version   : STRING (semver of replay packet schema; "1.0.0" for this spec)
  corpus_class     : ENUM ('golden' | 'edge_case' | 'failure_state' | 'entropy'
                          | 'chaos' | 'historical_regression' | 'cross_version_compat')

  // Capture provenance
  captured_at      : INTEGER (UTC milliseconds; wall-clock at time of capture)
  capture_source   : ENUM ('manual_authored' | 'property_shrink' | 'incident_capture'
                          | 'production_sample' | 'milestone_baseline')
  captured_by      : STRING (identity of engineer or automated system)
  pre_impl_version : STRING (semver of PRE implementation at capture time)
  constitution_version : STRING ("v1" at ratification; bumped on amendment)
  incident_id      : STRING? (present only for historical_regression class; links to incident record)
  milestone_tag    : STRING? (present only for cross_version_compat class; e.g., "phase-5-cutover")

  // Narrative annotation
  description      : STRING (human-readable description of behavioral scenario being captured)
  invariants_under_test : STRING[] (e.g., ["INV-3", "INV-7", "INV-9"])
  specification_refs    : STRING[] (e.g., ["PRE §8.3", "PRE §24.EC-4"])

  // Input state
  input            : ReplayInput

  // Expected output
  expected_output  : PRE_Output

  // Integrity
  input_hash       : STRING (fnv1a32 hex of canonical serialization of input)
  output_hash      : STRING (fnv1a32 hex of canonical serialization of expected_output)
  packet_hash      : STRING (sha256 hex of canonical serialization of entire packet minus packet_hash field)

  // Corpus governance
  status           : ENUM ('active' | 'archived')
  archived_at      : INTEGER? (UTC milliseconds; present only when status = 'archived')
  archived_reason  : STRING?  (present only when status = 'archived')
  archived_by      : STRING?  (present only when status = 'archived')
  superseded_by    : STRING?  (packet_id of replacement; present only when status = 'archived')
  retirement_record_id : STRING? (links to retirement record; present only when status = 'archived')
}
```

### 3.3 ReplayInput Structure

The `ReplayInput` fully specifies the input state consumed during a PRE invocation. It MUST contain everything PRE reads from the database, sealed as a static record:

```
TYPE ReplayInput = {
  screen_id   : STRING
  at          : INTEGER (UTC milliseconds; the timestamp passed to PRE.resolve())
  system_state: SystemStateSnapshot
}

TYPE SystemStateSnapshot = {
  screen       : ScreenRecord
  tv_group     : TvGroupRecord?
  area         : AreaRecord?
  venue        : VenueRecord         // MUST include venue.timezone (IANA string)
  organization : OrganizationRecord
  emergency    : EmergencyStateRecord?
  overrides    : OverrideRecord[]    // all overrides whose scope includes this screen at time `at`
  schedules    : ScheduleRecord[]    // all schedules whose scope includes this screen at time `at`
  campaigns    : CampaignRecord[]    // referenced by schedules
  content_items: ContentItemRecord[] // all content referenced by schedules, overrides, emergency
  sponsorships : SponsorshipContractRecord[] // active for this screen's area at time `at`
  last_delivery: ScreenDeliveryLogRecord?    // most recent delivery log for this screen
}
```

### 3.4 Canonical Serialization Rules

These rules are identical to those used by PRE's own `canonicalizeJson` function (PRE-REFERENCE-IMPLEMENTATION-v1.md §16.1), ensuring that the same determinism properties that govern PRE output govern fixture serialization:

1. **Object key ordering:** All JSON object keys sorted lexicographically by Unicode code point. This ordering is applied recursively to all nested objects.
2. **Array ordering:** Arrays preserve the order present in the data. Arrays are NOT sorted unless the specification defines a sort order for that field.
3. **Timestamp representation:** All timestamps represented as UTC millisecond integers (64-bit signed integers). ISO 8601 strings MUST NOT be used in canonical form — they introduce locale and timezone ambiguity.
4. **Timezone fields:** Stored as IANA timezone identifier strings (e.g., `"America/New_York"`). Never as UTC offsets. UTC offset interpretation is timestamp-dependent (DST); IANA identifiers are stable.
5. **Null retention:** Null values are retained explicitly. Fields with null values MUST NOT be omitted. `"field": null` is distinct from the absence of `"field"`.
6. **Boolean representation:** `true` and `false`. Not `1` and `0`. Not `"true"` and `"false"`.
7. **Integer precision:** All integers represented as JSON numbers without decimal points. `15000` not `15000.0`.
8. **Float precision:** Real numbers (confidence scores, share-of-voice fractions) rounded to 4 decimal places. `0.9700` not `0.97000000001`.
9. **UUID format:** Lowercase hyphenated UUID v4 strings: `"3f7d9b22-4a1c-4e5f-b812-9d3c1a7e0f2b"`. Not uppercase. Not without hyphens.
10. **String encoding:** UTF-8 throughout. No locale-dependent encoding.
11. **No trailing whitespace.** No indentation in canonical form.

### 3.5 Timestamp Handling

Every timestamp in a replay packet has exactly one canonical representation: a 64-bit signed integer expressing milliseconds since the Unix epoch (1970-01-01T00:00:00.000Z), in UTC.

The `at` field in `ReplayInput` is this canonical form. It is the value passed verbatim to `PRE.resolve()`. PRE converts it to venue-local time internally using the venue's IANA timezone and the `toVenueLocal()` function (PRE-REFERENCE-IMPLEMENTATION-v1.md §8.1). The replay packet does not store the pre-converted local time — doing so would create an additional derived value that could drift from the canonical computation.

For human readability, replay packet metadata MUST include an `at_iso8601` field alongside `at`:
```
at          : 1748390400000
at_iso8601  : "2026-05-27T19:00:00.000Z"   // informational only; not used in computation
```

The `at_iso8601` field is informational and MUST NOT be used by the replay harness. Only `at` (integer milliseconds) is used in computation.

### 3.6 Replay Packet Hashing

Three hash fields provide integrity verification at different levels of granularity:

**`input_hash`:** `fnv1a32(canonicalizeJson(input))` — verifies that the input state has not been corrupted or modified since capture.

**`output_hash`:** `fnv1a32(canonicalizeJson(expected_output))` — verifies that the expected output has not been corrupted or modified. This is the value the replay harness compares against `fnv1a32(canonicalizeJson(actual_output))` to determine pass/fail.

**`packet_hash`:** `sha256(canonicalizeJson(packet_without_packet_hash_field))` — a stronger integrity check over the entire packet. Computed by serializing the packet with the `packet_hash` field omitted (not present), then applying SHA-256. This enables detection of any modification to any field in the packet, including provenance metadata. SHA-256 is used here (vs. FNV-1a elsewhere) because this is an integrity seal, not a behavioral checksum — collision resistance matters.

All three hashes MUST be verified by the replay harness at packet load time. If any hash fails verification, the packet is considered corrupted and the replay run MUST fail with an `INTEGRITY_FAILURE` result, not a `BEHAVIORAL_DIVERGENCE` result. These are distinct failure modes requiring different responses.

### 3.7 Packet Schema Versioning

The `packet_version` field carries the semver of the replay packet schema specification. The initial version is `"1.0.0"`, corresponding to this document.

**Forward compatibility:** New fields MAY be added to the packet schema in minor versions (1.1.0, 1.2.0). The replay harness MUST ignore unknown fields when loading packets from schema versions with the same major version.

**Breaking changes:** Changes that alter the meaning of existing fields, change canonical serialization rules, or change the hash algorithm require a major version increment (2.0.0). A corpus migration is required: all active packets must be re-hashed against the new canonical form and their `packet_version` updated.

**Backward compatibility obligation:** The replay harness MUST support all major schema versions for which active packets exist in the corpus. Dropping support for a major schema version requires archiving all packets at that version first.

### 3.8 Forward Compatibility Rule

Identical packet bytes MUST produce identical replay outcomes forever — regardless of when the replay harness executes, what language the PRE implementation uses, or what infrastructure the replay harness runs on.

This rule has a specific implication for the PRE implementation: any change that would alter the `expected_output` of an existing active corpus packet — including changes to floating-point rounding, string serialization, SWRR ordering tie-breaking, or any other determinism-sensitive computation — constitutes a behavioral divergence from the corpus and MUST be treated as a regression until the retirement process formally recognizes the change.

---

## 4. Golden Manifest Corpus

### 4.1 Purpose of Golden Manifests

Golden manifest fixtures are the primary behavioral specification of PRE in executable form. Each one captures a specific resolution scenario, provides the complete input state, and seals the expected output. Together they constitute the minimum required coverage for any conformant PRE implementation.

An implementation that produces different output for any golden fixture is non-conformant. There are no exceptions. If the specification has changed — through constitutional amendment — the golden fixture is retired and replaced, not silently overridden.

### 4.2 Rule: Golden Outputs Cannot Change Without Constitutional Amendment

The expected output of a golden fixture is sealed at ratification. It represents the behavior mandated by the specification as understood at that time. Changing that expected output without amending the specification is prohibited, because the golden fixture and the specification are co-equal authorities.

If an engineer believes a golden fixture's expected output is wrong — that PRE should produce different output for those inputs — the correct path is:

1. Propose an amendment to PRE-REFERENCE-IMPLEMENTATION-v1.md identifying the behavioral change.
2. Complete the constitutional amendment process (ENGINEERING-CONSTITUTION-v1.md §30).
3. Upon amendment ratification, retire the affected golden fixture(s) through the retirement process (Section 10).
4. Add replacement golden fixture(s) capturing the amended behavior.

Deleting a golden fixture to "fix" a CI failure is a constitutional violation of the highest order. It is equivalent to falsifying the behavioral specification.

### 4.3 Golden Scenario: Single-Screen Structural Resolution (GOLD-001)

**Scenario description:** A single screen assigned to a tv_group in an area, with one campaign-linked schedule active at the evaluation time and no overrides, emergencies, or sponsorships active. PRE resolves at LEVEL_3 (Campaign Layer).

**Input state summary:**
- Screen: `status = 'active'`, assigned to tv_group and area
- Venue: timezone `"America/Chicago"`, active
- One campaign: `status = 'published'`
- One schedule: `campaign_id` set, `is_fallback = false`, `area_id = screen's area`, no day-of-week constraint, no intra-day time constraint, absolute window enclosing `at`
- One content item: `duration_ms = 30000`
- No emergency record
- No overrides
- No sponsorship contracts

**Evaluation time:** UTC timestamp placing wall-clock time in the middle of a normal business day in `America/Chicago` (not a DST transition).

**Expected resolution path:**
- LEVEL_0: No emergency → skip
- LEVEL_1: No operational overrides → skip
- LEVEL_2: No scheduled overrides → skip
- LEVEL_3: Campaign schedule active → resolve to single content item
- LEVEL_4: No sponsorship contracts → skip
- LEVEL_5: Normalize playlist → pass through
- LEVEL_6: Annotate confidence score

**Expected reason_trace (abbreviated):**
```
"L0:SKIP:no_active_emergency"
"L1:SKIP:no_operational_overrides"
"L2:SKIP:no_scheduled_overrides"
"L3:CAMPAIGN:schedule_id={uuid},campaign=Summer Menu 2026,specificity=AREA,won_by=only_active_rule"
"L4:SKIP:no_active_sponsorship_contracts"
"L5:NORMALIZED:1_item,source=campaign"
"L6:CONFIDENCE:0.9700,last_seen_8500ms_ago,checksum_match=true"
```

**Expected content_mix:**
```json
{ "campaign_pct": 1.0, "sponsor_pct": 0.0, "override_pct": 0.0,
  "fallback_pct": 0.0, "system_pct": 0.0 }
```

**Expected checksum:** Computed from the single playlist item per FNV-1a algorithm (PRE-REFERENCE-IMPLEMENTATION-v1.md §18).

**Expected version behavior:** Version = 1 if no prior `screen_versions` row; otherwise, version = prior version if checksum unchanged, prior version + 1 if checksum differs.

### 4.4 Golden Scenario: Area Inheritance (GOLD-002)

**Scenario description:** A screen assigned to a tv_group in an area, with a schedule targeting the area (SPECIFICITY_3). No screen-specific or tv_group-specific schedule exists. PRE must correctly inherit the area-level schedule rather than falling to fallback.

**Key verification:** INV-6 (No Content Amplification — content must come from an active rule). Specificity inheritance is not a fallback; it is defined behavior for the absence of a more-specific rule.

**Expected resolution path:** LEVEL_3 terminates with area-targeted schedule content. `reason_trace` MUST include specificity level at which the rule matched.

**Forbidden output:** System Fallback. If PRE incorrectly fails to inherit the area rule, it would fall to LEVEL_5 System Fallback. This is a regression of the inheritance semantics.

### 4.5 Golden Scenario: TV Group Override Precedence (GOLD-003)

**Scenario description:** A screen assigned to a tv_group. A LEVEL_1 operational override exists targeting the tv_group (SPECIFICITY_4). An area-level campaign schedule also exists (SPECIFICITY_3). The override MUST terminate base_playlist computation at LEVEL_1 without evaluating LEVEL_3.

**Key verification:** INV-5 (Level Termination). Once LEVEL_1 terminates, LEVEL_3 MUST NOT contribute to `base_playlist`. `reason_trace` MUST show LEVEL_3 as "not evaluated" or "skipped due to LEVEL_1 termination."

**Expected content_mix:**
```json
{ "campaign_pct": 0.0, "sponsor_pct": 0.0, "override_pct": 1.0,
  "fallback_pct": 0.0, "system_pct": 0.0 }
```

**Expected `skip_sponsorship`:** `true` (per PRE-REFERENCE-IMPLEMENTATION-v1.md §6 STEP_3, sponsorship is skipped when LEVEL_1 override terminates).

### 4.6 Golden Scenario: Screen Override Wins Over Group Override (GOLD-004)

**Scenario description:** Both a screen-targeted operational override (SPECIFICITY_5) and a tv_group-targeted operational override (SPECIFICITY_4) are active simultaneously. The screen-targeted override MUST govern.

**Key verification:** Within-level specificity precedence (PRE-REFERENCE-IMPLEMENTATION-v1.md §5.2). Higher specificity wins at LEVEL_1.

**Expected output:** Playlist from screen-targeted override content. TV group override content MUST NOT appear.

**Reason_trace MUST include:** `"won_by=specificity_5_over_specificity_4"` or equivalent human-readable text.

### 4.7 Golden Scenario: Emergency Absolute Precedence (GOLD-005)

**Scenario description:** An active emergency record exists for the screen's venue. A campaign schedule is also active. An operational override is also active. Emergency MUST suppress all other content.

**Key verification:** INV-7 (Emergency Absoluteness). LEVEL_0 MUST terminate immediately. No campaign, override, or sponsor content MAY appear.

**Expected output:**
- `resolution_level = 0`
- `active_playlist` contains only the emergency content item (or SYSTEM_EMERGENCY_FALLBACK if `emergency_states.content_id = null`)
- `content_mix.override_pct = 0.0`
- `content_mix.campaign_pct = 0.0`
- `content_mix.sponsor_pct = 0.0`

### 4.8 Golden Scenario: Emergency with Absent Content (GOLD-006)

**Scenario description:** Active emergency record with `content_id = null`. PRE MUST serve SYSTEM_EMERGENCY_FALLBACK.

**Expected output:**
```json
{
  "active_playlist": [{
    "content_id": "system-emergency",
    "type": "promo_slide",
    "data": { "headline": "Emergency", "subheadline": "Please follow staff instructions" },
    "duration_ms": 10000,
    "priority": 0,
    "source": "emergency"
  }],
  "is_fallback": true,
  "resolution_level": 0
}
```

**Key verification:** PRE-REFERENCE-IMPLEMENTATION-v1.md §21.7 — emergency remains active; system-emergency content is served; PRE does not throw.

### 4.9 Golden Scenario: Sponsorship Injection Below Capacity (GOLD-007)

**Scenario description:** Two campaign content items active (LEVEL_3). One sponsorship contract active with `share_of_voice = 0.25` (25%). Total sponsor share (0.25) is below `MAX_SPONSOR_CAPACITY` (0.60) and below `SATURATION_WARNING_AT` (0.40). SWRR interleaving produces a 3-item playlist: 2 campaign items + 1 sponsor item, weighted 75%/25%.

**Key verification:** INV-8 (Sponsorship Non-Penetration — only applies when NOT at LEVEL_0 or LEVEL_1; here we are at LEVEL_3+4 so sponsorship applies). Correct SWRR weighting.

**Expected content_mix:**
```json
{ "campaign_pct": 0.75, "sponsor_pct": 0.25, "override_pct": 0.0,
  "fallback_pct": 0.0, "system_pct": 0.0 }
```

**SWRR sequence:** With `WEIGHT_SCALE = 100`, campaign weight = 75, sponsor weight = 25. The SWRR algorithm (PRE-REFERENCE-IMPLEMENTATION-v1.md §16.2) produces a deterministic interleaved sequence. The expected sequence MUST be pre-computed and sealed in the fixture.

### 4.10 Golden Scenario: Sponsorship at Saturation (GOLD-008)

**Scenario description:** Three sponsorship contracts each with `share_of_voice = 0.30`, totaling 0.90 — above `MAX_SPONSOR_CAPACITY` (0.60). PRE MUST apply proportional reduction (PRE-REFERENCE-IMPLEMENTATION-v1.md §11.4).

**Expected behavior:** Each contract's effective share reduced proportionally: `0.30 / 0.90 × 0.60 = 0.2000`. Total sponsor share = 0.60. `SATURATION_WARNING_AT` advisory flag appears in `reason_trace`.

**Key verification:** Saturation enforcement produces exact proportional reduction; rounding to 4 decimal places; `content_mix.sponsor_pct = 0.6000` (tolerance ± 0.001).

### 4.11 Golden Scenario: Mandatory Campaign Protection (GOLD-009)

**Scenario description:** A campaign with `is_mandated = true`. A suppression override targeting this campaign's `campaign_id` exists, but the override was created by a user with `role < 'org_admin'`. PRE MUST NOT suppress the mandated campaign.

**Key verification:** PRE-REFERENCE-IMPLEMENTATION-v1.md §10.3 — suppression of mandated campaigns by non-org-admin actors is prohibited.

**Expected output:** Mandated campaign content appears in playlist despite the suppression override being active.

**Reason_trace MUST include:** `"L3:MANDATE_PROTECTED:campaign_id={uuid},suppression_rejected:actor_role_insufficient"`

### 4.12 Golden Scenario: Structural Fallback — Area-Level (GOLD-010)

**Scenario description:** No campaign schedules active for the screen at evaluation time. Area-level fallback schedules (`is_fallback = true`, `area_id = screen's area`) exist and are active. PRE MUST serve fallback content at LEVEL_5, not System Fallback.

**Key verification:** Fallback hierarchy (PRE-REFERENCE-IMPLEMENTATION-v1.md §17.1) — area-level fallback schedules take precedence over System Fallback.

**Expected output:** `is_fallback = false` (structural fallback is not the System Fallback); `content_mix.fallback_pct > 0.0`; `resolution_level = 5`.

### 4.13 Golden Scenario: System Fallback — No Content (GOLD-011)

**Scenario description:** No campaign schedules, no fallback schedules at any level in the hierarchy, no operational overrides, no emergency. PRE MUST serve SYSTEM_FALLBACK_ITEM.

**Expected output:**
```json
{
  "active_playlist": [{
    "content_id": "system-fallback",
    "type": "promo_slide",
    "data": { "headline": "ClubHub", "subheadline": "" },
    "duration_ms": 15000,
    "priority": 0,
    "source": "system"
  }],
  "is_fallback": true,
  "resolution_level": 5
}
```

**Key verification:** INV-2 (Totality) — PRE MUST NOT return an empty playlist. System Fallback is the terminal guarantee.

### 4.14 Golden Scenario: Offline Screen Confidence Degradation (GOLD-012)

**Scenario description:** Screen has not polled for 35 minutes. `last_delivery.acknowledged_at = at - 2_100_000ms`. Confidence computation applies STALE_THRESHOLD_OFFLINE (1,800,000ms = 30 minutes). Screen is beyond the offline threshold.

**Expected output:**
- `confidence_score = 0.0`
- `is_fallback = false` (PRE still resolves the correct playlist; the screen being offline does not change what PRE computes)
- `active_playlist` reflects current campaign content
- `reason_trace.level_6_device_truth` includes `"confidence_score: 0.0, staleness: OFFLINE, last_seen_35_minutes_ago"`

**Key verification:** Confidence score (PRE-REFERENCE-IMPLEMENTATION-v1.md §13.2) — staleness > 30 minutes → confidence = 0.0. INV-10 (Output Completeness). Confidence score MUST NOT influence the computed playlist (PRE-REFERENCE-IMPLEMENTATION-v1.md §13.3).

---

## 5. Edge-Case Corpus

### 5.1 Governance Rule

All 14 edge cases formally specified in PRE-REFERENCE-IMPLEMENTATION-v1.md §24 (EC-1 through EC-14) MUST have permanent active corpus entries. This is a minimum; additional edge-case fixtures MUST be added when discovered through property testing or production experience.

All edge fixtures remain permanently replayable. An edge fixture is never archived unless the underlying edge-case specification has been amended. The fact that a particular edge condition is extremely unlikely in production does not reduce the fixture's value — edge fixtures guard against regressions that are by definition difficult to reproduce operationally.

### 5.2 EC-1: Schedule with starts_at = ends_at (EDGE-001)

**Scenario:** A schedule where `starts_at = ends_at` (zero-length absolute window). This is rejected at creation time but may exist due to pre-validation data.

**Expected behavior:** `scheduleActive()` returns `false` for this schedule. The schedule MUST NOT contribute to resolution. No exception is thrown.

**Fixture MUST verify:** The schedule is silently ignored; resolution falls to the next applicable tier.

### 5.3 EC-2: Two Overrides Issued Same Millisecond (EDGE-002)

**Scenario:** Two operational overrides at identical specificity targeting the same screen, both with `issued_at` equal to the exact same millisecond.

**Expected behavior:** Lexicographically smaller `id` wins (PRE-REFERENCE-IMPLEMENTATION-v1.md §5.3). Output is deterministic — the same winning override is selected every time.

**Fixture MUST verify:** Identical inputs produce identical output; the winning override is always the one with the lexicographically smaller UUID.

### 5.4 EC-3: Campaign with One Item and Minimum Separation Requested (EDGE-003)

**Scenario:** Campaign has exactly one content item. `min_separation` constraint cannot be satisfied (no other items to interleave with). Item repeats unconditionally.

**Expected behavior:** PRE MUST NOT fail or return empty playlist. Single item repeats. No exception.

### 5.5 EC-4: Midnight-Crossing Schedule on DST Fall-Back Night (EDGE-004)

**Scenario:** A schedule with `time_of_day_start = 01:30` and `time_of_day_end = 00:30` (midnight crossing) in a timezone that falls back at 02:00 on the evaluation date. The ambiguous hour (01:00–02:00) occurs twice.

**Expected behavior:** The schedule matches BOTH instances of the wall-clock hour it spans. Pre-midnight window matches; post-midnight window matches. The ambiguous fall-back hour is matched twice. This is correct wall-clock behavior (PRE-REFERENCE-IMPLEMENTATION-v1.md §8.3).

**Fixture MUST verify:** PRE does not throw; the schedule appears active during both instances of the ambiguous hour. `is_dst_overlap = true` appears in the venue-local time annotation.

### 5.6 EC-5: Midnight-Crossing Schedule on DST Spring-Forward Night (EDGE-005)

**Scenario:** A schedule with `time_of_day_end` in the spring-forward gap (e.g., `time_of_day_end = 02:30` in a timezone that jumps from 02:00 to 03:00).

**Expected behavior:** The schedule's end time is effectively the gap start time (02:00). The schedule ends at the last millisecond before the gap. No timestamp during the gap matches the schedule. `is_dst_gap = true` in venue-local time annotation.

**Fixture MUST verify:** Three timestamps are provided: one before the gap, one in the gap, one after the gap. The fixture MUST show the schedule matching the pre-gap timestamp, not matching the gap timestamp, and not matching the post-gap timestamp (if it falls after the effective end time).

### 5.7 EC-6: PRE Invoked Mid-Screen-Assignment (EDGE-006)

**Scenario:** Screen has `tv_group_id` just set (committed to DB before PRE reads). PRE reads the new assignment.

**Expected behavior:** PRE resolves against the new area's content hierarchy. No inconsistency. `READ COMMITTED` isolation ensures a committed assignment is seen.

**Fixture MUST verify:** Screen with recently-assigned `tv_group_id` resolves correctly to the new area's content.

### 5.8 EC-7: Emergency Activated During PRE Invocation Window (EDGE-007)

**Scenario:** Emergency is activated between the moment PRE queries emergency state and the moment PRE returns. The current invocation does not see the emergency.

**Expected behavior:** The current invocation returns non-emergency content. The emergency is reflected on the next poll (within 15 seconds). Cache invalidation ensures no stale non-emergency manifest is served.

**Fixture MUST verify:** This is a two-packet edge fixture. PACKET-A: PRE invocation without emergency (emergency query returns null). PACKET-B: PRE invocation with emergency active (emergency query returns the record). Together they verify that the transition is a valid, non-erroneous state sequence, not a behavioral defect.

### 5.9 EC-8: Leap Day Schedule (EDGE-008)

**Scenario:** A schedule with `starts_at` on February 29 of a leap year. Evaluate at February 29 of the same year and at February 28 of the following (non-leap) year.

**Expected behavior:** Schedule active on February 29 of the leap year. Schedule NOT evaluated on February 28 of the following year (the schedule's `ends_at` or day-of-week constraint governs). No exception thrown regardless of whether the venue's timezone places the evaluation date in February 29 or not.

**Fixture MUST verify:** Timestamp handling for leap days produces correct venue-local day resolution.

### 5.10 EC-9: Exact-Boundary Timestamp (EDGE-009)

**Scenario:** Evaluation timestamp exactly equal to a schedule's `starts_at`, `ends_at`, override `start_time`, and override `end_time`. The PRE specification uses half-open intervals `[starts_at, ends_at)`.

**Expected behavior:** A rule with `starts_at = at` IS active at time `at` (inclusive start). A rule with `ends_at = at` is NOT active at time `at` (exclusive end). This applies to schedules, overrides, and sponsorship contracts.

**Fixture MUST verify:** Four cases: at = starts_at (active), at = ends_at (not active), at = starts_at - 1ms (not active), at = ends_at - 1ms (active).

### 5.11 EC-10: Empty Campaign Window (EDGE-010)

**Scenario:** A campaign with status `'published'` but all associated `campaign_content_items` rows deleted (or campaign has no items).

**Expected behavior:** PRE-REFERENCE-IMPLEMENTATION-v1.md §21.5 — campaign with no content items is treated as absent. Does not contribute to playlist. Does not prevent fallback activation.

**Fixture MUST verify:** Empty campaign passes through silently; resolution falls to next tier.

### 5.12 EC-11: Simultaneous Overrides at Same Specificity (EDGE-011)

**Scenario:** Two operational overrides at SPECIFICITY_4 (tv_group-targeted) for the same tv_group, both active at evaluation time, issued at different `issued_at` values.

**Expected behavior:** Override with later `issued_at` wins. Earlier override discarded for this resolution. Both remain active in DB.

**Fixture MUST verify:** Output reflects the later-issued override's content. No exception thrown for concurrent valid overrides (PRE-REFERENCE-IMPLEMENTATION-v1.md §9.2).

### 5.13 EC-12: Duplicate Specificity Collision (EDGE-012)

**Scenario:** Two schedules in LEVEL_3, both targeting the same content_id at the same specificity level with different priority values.

**Expected behavior:** Higher priority integer retains the content_id. Lower priority version deduplicated out. If priority equal: lexicographically smaller `id` wins.

**Fixture MUST verify:** Deduplication produces exactly one entry for the content_id; the winning entry is deterministically selected.

### 5.14 EC-13: Sponsor Saturation at Exactly MAX_SPONSOR_CAPACITY (EDGE-013)

**Scenario:** Sponsor contracts total exactly `MAX_SPONSOR_CAPACITY = 0.60`. No reduction applied (reduction only when EXCEEDING the ceiling, not at the ceiling).

**Expected behavior:** All contracts honored at their full share; total = 0.60. `content_mix.sponsor_pct = 0.6000`. No saturation advisory (advisory triggers at `SATURATION_WARNING_AT = 0.40` but saturation enforcement only reduces above 0.60).

**Fixture MUST verify:** Exact-threshold boundary behavior is stable and does not produce floating-point errors that push the total above 0.60.

### 5.15 EC-14: Expired Override Race Condition (EDGE-014)

**Scenario:** Override with `end_time = at`. PRE evaluates at exactly `end_time`. Per half-open interval semantics, the override is NOT active at `end_time` (exclusive end).

**Expected behavior:** Override does not govern. Resolution falls to LEVEL_2 or LEVEL_3. No exception.

**Fixture MUST verify:** Exclusive end boundary correctly excludes the override at exactly `end_time`. Two sub-cases: at = end_time (not active), at = end_time - 1ms (active).

### 5.16 EC-15: Stale Screen Confidence Degradation Curve (EDGE-015)

**Scenario:** Three separate fixtures capturing confidence score at: staleness = 0ms (1.0), staleness = 15,000ms (one poll interval, 1.0), staleness = 30,001ms (just past nominal threshold, ~0.999), staleness = 165,000ms (mid-degraded range, linear interpolation), staleness = 300,001ms (just past degraded threshold, ~0.699), staleness = 1,800,001ms (just past offline threshold, 0.0).

**Key verification:** Confidence score computation per PRE-REFERENCE-IMPLEMENTATION-v1.md §13.2. Boundary values at thresholds and linear interpolation values at midpoints are all captured separately.

---

## 6. Chaos Fixture Corpus

### 6.1 Purpose

Chaos fixtures capture the expected system behavior under injected failure conditions. Unlike PRE replay fixtures — which verify PRE output for specific input states — chaos fixtures verify system-level degradation behavior: stale cache serving, System Fallback activation, invariant preservation under failure, and correct recovery when failures resolve.

Chaos fixtures do not substitute for live chaos test execution. They define the expected degradation profile against which live test outcomes are evaluated.

### 6.2 Structure of a Chaos Fixture

```
TYPE ChaosFixture = {
  fixture_id     : STRING (UUID v4)
  scenario_id    : STRING (e.g., "CHAOS-001")
  description    : STRING
  failure_mode   : ENUM ('backend_restart' | 'db_restart' | 'network_partition'
                        | 'cache_loss' | 'event_bus_lag' | 'clock_skew'
                        | 'poll_storm' | 'stale_manifest_recovery')
  failure_params : OBJECT    // failure-specific parameters (duration_ms, lag_ms, etc.)

  pre_failure_state  : SystemStateSnapshot   // state before failure injected
  during_failure     : ChaosExpectation      // expected behavior during failure window
  post_failure       : ChaosExpectation      // expected behavior after failure resolves

  preserved_invariants : STRING[]   // INV-x and FP-x identifiers that must hold throughout
  forbidden_outcomes   : STRING[]   // behaviors that must NOT occur
  acceptable_degradation : STRING[] // explicitly tolerated deviations from nominal behavior
}

TYPE ChaosExpectation = {
  is_fallback_expected       : BOOLEAN
  stale_cache_serving_expected : BOOLEAN
  max_stale_age_ms           : INTEGER?   // maximum tolerated stale age
  p95_latency_budget_ms      : INTEGER?
  invariants_verified        : STRING[]
}
```

### 6.3 CHAOS-001: Backend Restart During Poll

**Failure mode:** Application process SIGTERM and immediate restart. In-process LRU cache cleared.

**Pre-failure state:** 10 screens actively polling; all screens have cached manifests in DB and LRU.

**During failure (restart window, ~2-5s):** No responses possible. Screens retry on next poll interval.

**Post-failure (first 120s):** Cache miss expected; PRE recomputes from DB. `manifest_cache_hit_ratio` may be 0.0 initially.

**Preserved invariants:** INV-3 (recomputed output = original output for same state), INV-2 (no null responses after restart completes).

**Forbidden outcomes:** Version decrement; different PRE output for same input state; 5xx responses after process accepts connections.

**Acceptable degradation:** Zero cache hits for up to 120 seconds post-restart.

### 6.4 CHAOS-002: PostgreSQL Restart with MAX_STALE_AGE Window

**Failure mode:** DB unavailable for 45,000ms (45 seconds), within MAX_STALE_AGE (60,000ms).

**During failure:** Stale LRU cache entries served. Response marked as `cache_age_ms > 0`. `is_fallback = false` if LRU entry exists and is within MAX_STALE_AGE.

**After MAX_STALE_AGE exceeded:** System Fallback served. `is_fallback = true`.

**Post-recovery:** PRE recomputes; fresh manifests served; version preserved from prior to failure.

**Forbidden outcomes:** Stale cache served past MAX_STALE_AGE without `is_fallback = true` transition; version counter decremented after recovery; cache entry with `version = 0`.

### 6.5 CHAOS-003: Cache Table Cleared Mid-Operation

**Failure mode:** `DELETE FROM manifest_cache` executed during active polling.

**Expected behavior:** PRE recomputes from DB for all affected screens. Recomputed output checksums MUST match prior cached checksums (same SystemState → same PRE output). Version preserved via `screen_versions` table (which is not cleared).

**Forbidden outcomes:** Different PRE output for same SystemState after cache loss; version increment without checksum change; 5xx responses.

### 6.6 CHAOS-004: Event Bus Lag (30-Second Delay)

**Failure mode:** 30-second delay on all event bus message delivery including cache invalidation events.

**Expected behavior:** Cache invalidation delayed by lag duration. Stale manifests served within `valid_until` horizon. After `valid_until` passes: PRE recomputes (time-based backstop); fresh manifest served even without cache invalidation event.

**Preserved invariants:** INV-4 (version monotonicity — version still increments correctly when cache eventually invalidated); INV-3.

**Forbidden outcomes:** Manifest served past `valid_until + MAX_STALE_AGE` without recomputation.

### 6.7 CHAOS-005: Clock Skew (±5 Minutes)

**Failure mode:** Application server clock adjusted ±5 minutes relative to database.

**Expected behavior:** PRE uses `at` parameter passed by Manifest Delivery System, not process wall clock. Schedule evaluations unaffected by application server clock skew. INV-9 preserved.

**Forbidden outcomes:** PRE producing different output based on application server clock; timezone evaluation using process system time.

**Preserved invariants:** INV-9 (Timezone Isolation) — demonstrably unaffected by clock skew.

### 6.8 CHAOS-006: Poll Storm (500 Concurrent Requests)

**Failure mode:** 500 concurrent manifest poll requests within 1 second.

**Expected behavior:** p95 latency ≤ 500ms. No 5xx responses. No data corruption from concurrent version counter increments.

**Forbidden outcomes:** Different PRE outputs for same screen/state from concurrent invocations; version counter incremented more than once per checksum change; deadlock.

### 6.9 CHAOS-007: Emergency Activated During Active Storm

**Failure mode:** Emergency activated while 500 concurrent poll requests are in-flight.

**Expected behavior:** Emergency activation synchronously invalidates all venue manifest cache entries within 5 seconds (ENGINEERING-CONSTITUTION-v1.md §23.1). In-flight requests that complete after invalidation MUST trigger recomputation against emergency state. All screens in venue serve emergency content within one poll interval after activation.

**Forbidden outcomes:** Any screen serving non-emergency content more than 15 seconds after emergency activation (one poll interval); version decrement after emergency activation.

---

## 7. Entropy Fixture Corpus

### 7.1 Purpose

Entropy fixtures prove that the entropy detection and observability system (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md) correctly computes metrics and advisory signals for known configuration states. They are not PRE replay fixtures and do not verify PRE output. They verify that the entropy computation layer correctly derives M-01 through M-12 from SystemState, and that the Staleness Index and Entropy Score computations are deterministic.

**Entropy fixtures prove observability, not prevention.** They validate that the system correctly identifies and surfaces operational drift. They do not validate that the system prevents drift, corrects drift, or blocks operator actions.

### 7.2 Entropy Progression Fixture Structure

```
TYPE EntropyProgressionFixture = {
  fixture_id   : STRING (UUID v4)
  scenario_id  : STRING (e.g., "ENT-001")
  description  : STRING
  pattern_type : ENUM ('override_accumulation' | 'campaign_fragmentation'
                      | 'sponsor_saturation' | 'emergency_misuse'
                      | 'shadow_scheduling' | 'priority_escalation')
  steps        : EntropyStep[]
}

TYPE EntropyStep = {
  step_number    : INTEGER
  week_offset    : INTEGER   // weeks from initial healthy state
  state_snapshot : SystemStateSnapshot
  expected_metrics : {
    M01_override_divergence_pct   : REAL
    M03_campaign_coverage_pct     : REAL
    M04_priority_range_width      : INTEGER
    M06_sov_warning_duration_days : INTEGER
    M08_emergency_activations_30d : INTEGER
    M11_override_as_schedule_count: INTEGER
    M12_staleness_index           : REAL
    entropy_score                 : REAL
    score_label                   : STRING
  }
  expected_advisories : AdvisoryExpectation[]
  narrative           : STRING   // human description of what happened this week
}
```

### 7.3 ENT-001: Override Accumulation Progression

**Pattern:** Over 10 weeks, overrides accumulate without review. M-01 (Override Divergence Rate) increases monotonically. The entropy score progresses from Healthy through Nominal, Drifting, and into Degraded.

**Step sequence:**
- Week 0: 0 overrides, M-01 = 0%, entropy = 0 (Healthy)
- Week 2: 3 overrides (all with expiry), M-01 = 5%, entropy = 12 (Healthy)
- Week 4: 6 overrides (2 without expiry), M-01 = 10%, entropy = 24 (Nominal), M-02 advisory fires
- Week 6: 12 overrides (6 permanent), M-01 = 20%, entropy = 38 (Nominal → Drifting boundary)
- Week 8: 18 overrides (12 permanent, some >30d old), M-01 = 30%, entropy = 55 (Drifting)
- Week 10: 22 overrides (18 permanent), M-01 = 37%, M-11 = 6, entropy = 67 (Degraded)

**Advisory escalation path:** Tier 1 at Week 4 (approaching advisory threshold); Tier 2 at Week 6 (crossing advisory threshold); Tier 3 confirmation gate fires on Week 8 override creation (M-01 > 15%).

**Final state:** Degraded. All 22 overrides remain active. No automatic correction has occurred. Entropy score accurately reflects accumulated drift.

### 7.4 ENT-002: Campaign Fragmentation Progression

**Pattern:** Over 12 weeks, schedule-campaign linkage deteriorates. Orphaned schedules accumulate. M-03 (Campaign Coverage Rate) trends downward.

**Step sequence:**
- Week 0: 100% schedules linked to campaigns, M-03 = 100%, entropy = 0
- Week 3: 85% linked (some campaigns archived without cleaning up schedules), M-03 = 85%
- Week 6: 65% linked (knowledge transfer gap; new operator creates direct schedules), M-03 = 65%, advisory fires
- Week 9: 45% linked, M-03 = 45%, entropy = 48 (Drifting)
- Week 12: 28% linked, M-03 = 28%, entropy = 63 (Degraded)

**Final state:** Platform operationally diverged from campaign-based scheduling model. PRE is correct; it resolves whatever schedules are present. The entropy system correctly identifies the model has drifted.

### 7.5 ENT-003: Sponsor Saturation Drift

**Pattern:** Three sponsorship contracts accumulate over 5 months. M-06 (SOV Warning Duration) increases as daily SOV exceeds SATURATION_WARNING_AT.

**Step sequence:**
- Month 1: 1 contract at 30% SOV, no warning
- Month 2: 2 contracts totaling 50% SOV, 14 days above warning threshold, M-06 = 14
- Month 3: 3 contracts totaling 72% SOV (exceeds MAX_SPONSOR_CAPACITY; proportional reduction applied), M-06 = 45 days
- Month 5: Contracts continue, M-06 = 105 days, M-07 (editorial rate) = 40%

**Fixture MUST verify:** M-06 correctly counts consecutive days above SATURATION_WARNING_AT; proportional reduction is applied by PRE at LEVEL_4 when total exceeds MAX_SPONSOR_CAPACITY; entropy score reflects saturation duration.

### 7.6 ENT-004: Emergency Misuse Progression

**Pattern:** Emergency activations used as scheduling workarounds. M-08 (Emergency Activation Rate) increases; M-09 (Reason Completion) decreases.

**Step sequence:**
- Month 1: 1 activation (genuine), reason field complete, M-08 = 1, M-09 = 100%
- Month 2: 4 activations (2 genuine, 2 operational), M-08 = 4, M-09 = 50%, advisory fires
- Month 3: 8 activations, M-08 = 8, entropy Degraded for this component
- Month 4: 11 activations, Tier 3 confirmation gate fires on every activation attempt

**Fixture MUST verify:** M-09 correctly calculates the proportion of activations with non-null, non-empty reason fields.

---

## 8. Historical Incident Replay Archive

### 8.1 Capture Obligation

Every production incident in which PRE produces unexpected output — or in which any PRE invariant (INV-1 through INV-10) is violated — MUST produce a replay fixture promoted to the corpus before the incident is closed. The incident is not closed until the fixture is committed.

This obligation exists regardless of:
- How minor the divergence appears
- Whether the divergence affected operator-visible output
- Whether the incident was caused by a now-fixed bug
- Whether the scenario is considered unlikely to recur

### 8.2 Incident Capture Rules

At incident detection, the following MUST be captured immediately, before any state is modified:

1. **Raw state capture:** A complete `SystemStateSnapshot` reflecting the system state at the moment the unexpected behavior was observed. This MUST be captured from the database's authoritative tables, not from cache.

2. **Unexpected output capture:** The exact `PRE_Output` that was produced (if observable from logs and structured output). If the output cannot be reconstructed exactly, the structured log must be used as the authoritative record.

3. **Incident metadata:** Incident ID, detection time, affected screen IDs, affected venue, describing engineer identity, initial classification.

These artifacts are sealed. They MUST NOT be modified after capture even if subsequent investigation reveals additional context.

### 8.3 Incident-to-Fixture Promotion Process

During incident investigation, two replay packets are produced:

**INCIDENT-CAPTURE packet:** The exact input state and the incorrect output. Classified as `corpus_class = 'historical_regression'`. Annotated with `incident_id`. Status = `'archived'` (because this output is incorrect; it is retained as historical record, not as a regression gate).

**CORRECTED-BEHAVIOR packet:** The exact input state and the correct output (as determined by investigation). Status = `'active'`. This becomes the regression gate that prevents future recurrence.

If the investigation determines that the "unexpected" behavior was actually correct and the concern was unfounded, only the incident capture packet is created, and it is annotated accordingly. No corrected-behavior packet is created in this case.

### 8.4 Anonymization Rules

Production replay packets capture real operational data including screen IDs, venue IDs, content IDs, operator identities in override records, and schedule configurations. This data MUST be preserved intact for replay fidelity.

Access to historical incident replay packets is restricted to engineers with production database access clearance. Incident packets MUST NOT be exposed through any API, exported to external systems, or included in open-source repositories.

For documentation and public discussion of incidents, anonymized descriptions (replacing UUIDs with placeholders like `{screen-A}`, `{venue-1}`) MUST be used. The anonymized description is supplementary documentation attached to the incident record, separate from the canonical replay packet.

### 8.5 Retention Policy

Historical incident replay packets are retained permanently. They are never subject to data retention policies that would delete or expire them. They are never archived (the INCIDENT-CAPTURE packet, capturing incorrect behavior, is technically `status = 'archived'` in the governance sense, but it is retained forever in the corpus store).

### 8.6 Indexing Strategy

Incident replay packets MUST be indexed by:

- `incident_id` (link to incident management system)
- `affected_venue_id` (enables venue-specific incident history lookup)
- `captured_at` (chronological browsing)
- `corpus_class` (filter to `historical_regression` class)
- `invariants_under_test` (find all incidents where INV-7, etc., was tested)

The corpus index supports these lookups in O(log n) time. The index is maintained as a separate metadata table, not embedded in individual packet files.

---

## 9. Cross-Version Equivalence Rules

### 9.1 The Fundamental Rule

A PRE implementation change is valid if and only if the full active corpus passes at 100%. This rule has no exceptions. "The failing fixture represents a corner case that never occurs in production" is not a valid argument for ignoring a corpus failure. "The behavior intentionally changed" is not a valid argument for ignoring a corpus failure — it is an argument for the retirement process.

The corpus is the specification in executable form. If the corpus and the implementation disagree, the implementation is wrong until demonstrated otherwise through formal retirement.

### 9.2 Replay Behavior During PRE Upgrades

When a new PRE implementation (language change, major refactor, version upgrade) is evaluated:

1. Run the full active corpus against the new implementation.
2. For every passing packet: the implementation is confirmed equivalent for that scenario.
3. For every failing packet: investigate to determine whether the failure is an unintended regression or an intentional behavioral change.
4. **For unintended regressions:** Fix the implementation. Do not retire the fixture.
5. **For intentional behavioral changes:** Initiate the retirement process (Section 10). Do not merge until retirement is complete and replacement fixtures are passing.

The upgrade is not valid until step 5 results in 100% pass rate for the post-retirement corpus.

### 9.3 Checksum Stability Expectations

The FNV-1a 32-bit checksum algorithm and its constants (FNV1A_OFFSET_BASIS = 2,166,136,261; FNV1A_PRIME = 16,777,619; FNV1A_MOD = 2^32) are constitutionally fixed. The canonical serialization rules that produce the input string to the checksum are defined in PRE-REFERENCE-IMPLEMENTATION-v1.md §16.1 and §18.1 and in this document §3.4.

Any implementation that produces a different checksum for the same playlist has violated determinism, regardless of whether the playlist content is operationally equivalent. Checksum stability is a constitutional requirement, not a performance optimization.

**Checksum stability across implementations:** The four test vectors from PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B MUST pass against every implementation. These vectors are part of the corpus and MUST NOT be retired.

### 9.4 Tolerated Differences Taxonomy

Between implementation generations, certain output field differences are tolerated and MUST NOT count as replay failures. These tolerated differences represent fields where operational improvements are permitted without behavioral regression:

| Field | Tolerated change | Rationale |
|-------|-----------------|-----------|
| `reason_trace` contents | Addition of more detailed trace entries | New implementation may provide richer explanations; existing entries MUST still be present |
| `computed_ms` | Any change | Execution timing is not a behavioral output |
| `valid_until` | Change within MIN_VALID_DURATION floor | Precision of future boundary computation may improve |
| `packet_version` | Different schema version in new capture | Metadata field, not behavioral |

**Not tolerated (failures):**

| Field | Any change = failure |
|-------|---------------------|
| `active_playlist` (order, content_ids, duration_ms values) | Behavioral output |
| `checksum` | Behavioral output |
| `is_fallback` | Behavioral output |
| `resolution_level` | Behavioral output |
| `content_mix` (any component) | Behavioral output |

### 9.5 Parity Confidence Threshold

Cross-version equivalence is binary: 100% pass rate for active corpus entries that are not in the retirement pipeline. There is no partial pass threshold. A 99.9% pass rate on a corpus of 1,000 packets means 1 unexplained behavioral divergence, which is unacceptable.

### 9.6 Canary Replay Requirements

During Phase 5 canary rollout (IMPLEMENTATION-ROADMAP-v1.md), the cross-version compatibility fixtures MUST be executed against the PRE-enabled canary screens at each canary advancement step. Replay equivalence MUST be confirmed before advancing from each step (10% → 50% → 100%).

### 9.7 Rollback Triggers

The following conditions MUST trigger an immediate halt of PRE rollout and initiation of rollback:

- Any active corpus packet produces a divergent output on PRE-enabled screens
- `is_fallback` rate on PRE-enabled screens exceeds the baseline measured on legacy-engine screens
- Any CONSTITUTIONAL_BREACH alert on PRE-enabled screens
- Shadow mode divergence rate (tracked separately from corpus replay) exceeds zero forbidden-difference divergences during the 7-day clean gate

Rollback is executed by setting `screens.pre_enabled = false` for all canary screens. This reverts all affected screens to the legacy engine without data loss.

---

## 10. Fixture Mutation Governance

### 10.1 Append-Only Rule

The canonical corpus is append-only. No fixture is modified in place after ratification. No fixture is deleted. The only permitted state transitions for a fixture are:

```
DRAFT → ACTIVE    (ratification)
ACTIVE → ARCHIVED (retirement, with replacement)
```

An `ARCHIVED` fixture remains in the corpus store permanently. It is excluded from the active regression gate but is not removed from the index.

### 10.2 Who May Add Fixtures

Any engineer with commit access to the repository may add new corpus fixtures, subject to the review requirements in §10.4. Automated systems (property test harness, production sample capture, incident capture tooling) may add fixtures through automated pull requests that require human approval before merge.

No fixture is added to the active corpus without human review.

### 10.3 Who May Retire Fixtures

Only engineers with commit access may initiate the retirement process. Retirement requires:

1. A documented justification identifying the behavioral change that makes the fixture incorrect.
2. A reference to the constitutional amendment or specification correction authorizing the change.
3. A replacement fixture (or set of fixtures) capturing the correct behavior under the new specification.
4. Verification that all replacement fixtures pass against the current implementation.
5. A retirement record (see §10.5) committed to the corpus alongside the archived fixture.

Automated systems MUST NOT retire fixtures. No tool or script may programmatically set a fixture's status to `'archived'` without a human approval step.

### 10.4 Review Requirements

**Adding a golden fixture:** Requires review by at least one engineer other than the author. Reviewer verifies: input state correctly represents the claimed scenario, expected output is computed correctly per specification, description and specification_refs are accurate.

**Adding an edge-case fixture (automated):** Automated property-test shrink additions require human review of the shrunk scenario description and expected output before the pull request is merged. The harness creates the pull request; a human approves it.

**Adding a historical regression fixture:** Requires incident lead review plus one other engineer. The incident ID MUST be referenced. Both the incident-capture packet and the corrected-behavior packet MUST be reviewed together.

**Retiring a fixture:** Requires review by at least two engineers. One reviewer must verify the specification change justifying the retirement. The other reviews the replacement fixture correctness. Retirement without replacement is only permitted when the behavioral scenario itself is being constitutionally removed (e.g., a resolution level is removed from the algorithm).

### 10.5 Retirement Record Format

```
TYPE RetirementRecord = {
  retirement_id        : STRING (UUID v4)
  retired_packet_id    : STRING
  retired_at           : INTEGER (UTC milliseconds)
  retired_by           : STRING
  retirement_reason    : STRING (full explanation)
  amendment_reference  : STRING? (constitutional amendment ID or specification correction ref)
  replacement_packet_ids : STRING[] (IDs of newly-added fixtures replacing this one)
  reviewed_by          : STRING[] (identities of both reviewers)
  review_completed_at  : INTEGER (UTC milliseconds)
}
```

Retirement records are stored in the corpus alongside fixtures. They are permanent.

### 10.6 The CI Invariant

**A failing fixture MUST NOT be deleted or retired to make CI pass.** This rule is the operational expression of the corpus's authority. If a fixture is failing in CI, the correct responses are:

1. Fix the implementation so the fixture passes.
2. If the fixture represents behavior that has been intentionally changed through specification amendment, initiate the retirement process.

There is no third option. Bypassing a failing fixture by removing it from the active corpus without a retirement record is a CONSTITUTIONAL_BREACH.

The CI gate MUST make it structurally difficult to bypass this rule: the retirement process MUST require the retirement record to be present in the same commit as the status change, and the retirement record MUST reference the replacement fixture IDs that now pass.

---

## 11. Corpus Storage Architecture

### 11.1 Repository Layout

The canonical corpus lives in a dedicated directory within the platform repository. The layout is:

```
corpus/
  CORPUS-INDEX.json         # Authoritative index of all packets; updated on every add/retire
  golden/
    GOLD-001.json
    GOLD-002.json
    ...
  edge_cases/
    EDGE-001.json
    EDGE-002.json
    ...
  failure_states/
    FAIL-001.json
    ...
  entropy/
    ENT-001/
      step-00.json
      step-01.json
      ...
    ENT-002/
      ...
  chaos/
    CHAOS-001.json
    ...
  historical_regression/
    YEAR/MONTH/
      INC-{incident_id}-capture.json
      INC-{incident_id}-corrected.json
  cross_version_compat/
    phase-2-shadow-baseline/
      COMPAT-001.json
      ...
    phase-5-cutover-baseline/
      ...
  archived/
    golden/
      GOLD-{id}-retired-{date}.json
    edge_cases/
      ...
    retirement_records/
      RET-{id}.json
  integrity/
    corpus-checksum-{date}.sha256  # daily integrity snapshots
```

### 11.2 Fixture Naming Conventions

**Pattern:** `{CLASS_PREFIX}-{SEQUENCE_NUMBER}.json`

| Class | Prefix | Example |
|-------|--------|---------|
| Golden | GOLD | GOLD-001.json |
| Edge-Case | EDGE | EDGE-001.json |
| Failure-State | FAIL | FAIL-001.json |
| Entropy progression | ENT | ENT-001/step-00.json |
| Chaos | CHAOS | CHAOS-001.json |
| Historical Regression | INC | INC-{incident_id}-{type}.json |
| Cross-Version | COMPAT | COMPAT-001.json |

Sequence numbers are assigned monotonically within each class. A sequence number once assigned to a packet is never reassigned, even if the packet is archived. The sequence number is part of the packet's permanent identity.

### 11.3 CORPUS-INDEX.json

The corpus index is the authoritative registry of all packets. It is updated atomically with every fixture add or retire operation. The index enables O(log n) lookup by packet_id, scenario_id, corpus_class, status, and invariants_under_test.

```
TYPE CorpusIndex = {
  schema_version : STRING ("1.0.0")
  generated_at   : INTEGER (UTC milliseconds)
  total_active   : INTEGER
  total_archived : INTEGER
  entries        : CorpusIndexEntry[]
}

TYPE CorpusIndexEntry = {
  packet_id         : STRING
  scenario_id       : STRING
  corpus_class      : STRING
  status            : STRING
  file_path         : STRING (relative to corpus/ directory)
  description       : STRING (one line)
  invariants_under_test : STRING[]
  captured_at       : INTEGER
  packet_hash       : STRING
}
```

The `packet_hash` in the index enables integrity verification without loading the full packet: compute the expected hash from the canonical file and compare.

### 11.4 Binary Artifact Handling

Some fixtures may reference binary content (images, video thumbnails) as content item data. Binary content MUST NOT be embedded in JSON fixture files. Binary artifacts are stored separately:

```
corpus/
  binary_assets/
    {content_id}/
      original.{ext}
      sha256.txt   // SHA-256 of the binary file; embedded in fixture as data.asset_hash
```

The fixture references binary content by `content_id` and `asset_hash`. The replay harness uses the `asset_hash` to verify the binary asset, not the binary content itself (PRE does not load binary content; it references `content_id` and metadata only). Binary assets MUST be retained permanently alongside fixtures.

### 11.5 Compression Rules

**Fixture files:** Stored uncompressed in the repository. JSON readability matters for human review. Git handles compression transparently for storage efficiency.

**Archive storage:** Archived fixtures and the `archived/` directory contents are compressed with gzip (`.json.gz`) to reduce repository footprint. The corpus tooling MUST transparently decompress archived fixtures for integrity verification and replay.

**Snapshot storage:** Daily integrity snapshot files (SHA-256 hashes of all active packet files) are stored uncompressed.

### 11.6 Replay Index

The replay harness maintains a runtime index built from `CORPUS-INDEX.json` that enables efficient fixture lookup by scenario and filter criteria. The runtime index is never persisted — it is rebuilt from the canonical corpus on each harness invocation.

Lookup performance requirements: Filter to active fixtures of a specific class: O(n) where n is total active count. Lookup by packet_id: O(1) via hash map.

### 11.7 Fixtures Are Portable and Implementation-Independent

A fixture file contains everything needed to replay the scenario: the complete input state, the expected output, and the canonical hashes. There are no external references to live system state, environment variables, database connections, or implementation-specific constants (other than the mathematical constants embedded in the algorithms, which are part of the specification).

A fixture authored in 2026 MUST be replayable in 2031 on a different operating system, in a different language implementation of PRE, on a different database server, without any dependency on the 2026 runtime environment. The fixture is self-contained.

The only external dependency is the replay harness itself — specifically, the in-memory database mock that translates the `SystemStateSnapshot` into database query responses. This mock is part of the harness, not the fixture.

---

## 12. Replay Determinism Constraints

### 12.1 The Nondeterminism Prohibition

Any source of nondeterminism within PRE destroys the replay guarantee. Nondeterminism is any computation whose output can differ between invocations with identical inputs. The following sources of nondeterminism are prohibited within PRE and constitute violations of INV-1 and INV-3 (ENGINEERING-CONSTITUTION-v1.md §3):

### 12.2 Unordered Object Iteration

JavaScript/TypeScript `Object.keys()`, Python `dict` iteration, and equivalent in other languages may or may not preserve insertion order depending on runtime version and implementation. Any iteration over an object's keys within PRE MUST use an explicitly sorted iteration:

**Prohibited:** `for (const key in obj)` where key order matters to the output.

**Required:** `Object.keys(obj).sort()` or equivalent — consistent with `canonicalizeJson()`.

The `canonicalizeJson()` function (PRE-REFERENCE-IMPLEMENTATION-v1.md §16.1) already enforces this for serialization. The prohibition extends to any internal computation where object key iteration order influences output.

### 12.3 Unstable Sorting

Any sort used within PRE on a collection where equal elements may appear in arbitrary order MUST use a stable comparator with a deterministic tiebreaker.

**Prohibited:** `array.sort((a, b) => b.priority - a.priority)` when `priority` values may be equal — produces undefined order for equal-priority items.

**Required:** All sort operations include a final tiebreaker on `id` (lexicographic ascending) to eliminate ties deterministically (ENGINEERING-CONSTITUTION-v1.md §14.3).

### 12.4 RNG Usage

No random number generator, pseudo-random number generator, or any function that draws from a random source MAY be called from within PRE. This prohibition is absolute (INV-1, INV-3). The SWRR algorithm, the specificity comparison, the checksum computation — none of these use or require randomness. Any algorithm that requires randomness is wrong for PRE.

The PRNG used by the property test harness to generate test inputs (Section 4) is external to PRE and does not violate this rule.

### 12.5 Timestamp Leakage

**Prohibited within PRE:**
- `new Date()` — reads the process wall clock
- `Date.now()` — reads the process wall clock
- `performance.now()` — reads the process timer
- Any function that reads the system clock

**Required:** All time-dependent computations within PRE use the `at` parameter (passed in milliseconds) and the venue's IANA timezone via `toVenueLocal(at, venue.timezone)`. No other time source is permitted.

The `computed_ms` field in `PRE_Output` records execution duration and is the ONLY field that references wall-clock time — and it is explicitly excluded from the behavioral checksum (it is not included in the checksum computation).

### 12.6 Locale-Sensitive Formatting

**Prohibited within PRE:**
- `toLocaleDateString()`, `toLocaleTimeString()`, `toLocaleString()` — locale-dependent
- `Intl.DateTimeFormat` with locale-dependent options — output varies by runtime locale
- Any string comparison that uses locale-aware collation

**Required:** All string comparisons use byte-level (Unicode code point) lexicographic ordering. All date/time formatting uses explicit UTC-millisecond arithmetic or the `toVenueLocal()` function.

### 12.7 Timezone Leakage

**Prohibited within PRE:**
- Using `process.env.TZ` — environment-dependent
- Using the runtime's default timezone — host-dependent
- Interpreting a timestamp as local time without explicitly specifying the timezone

**Required:** PRE uses only `venue.timezone` (IANA string from the database) to convert UTC timestamps to venue-local time. No other timezone source is permitted (INV-9, FP-10).

### 12.8 Floating-Point Instability

Floating-point arithmetic is deterministic on IEEE 754-compliant hardware given identical inputs and identical operation sequence. However, the following patterns introduce instability:

**Prohibited:**
- Accumulating sums in arbitrary iteration order (floating-point addition is not associative; order matters)
- Using `Math.random()` as any tiebreaker
- Comparing floats with `===` without rounding

**Required:** All floating-point accumulations use a fixed iteration order (e.g., sorted by `id`). Confidence scores and content_mix percentages are rounded to 4 decimal places before storage and comparison (PRE-REFERENCE-IMPLEMENTATION-v1.md §13.2, §12.2).

### 12.9 Async Race Ordering

**Prohibited within PRE:**
- Concurrent (Promise.all or equivalent) database queries whose results are merged in arrival order
- Event loop microtask ordering dependencies

**Required:** All database queries within a single PRE invocation are executed within a single `READ COMMITTED` transaction (PRE-REFERENCE-IMPLEMENTATION-v1.md §3.3). Queries execute sequentially within that transaction. Results are processed in the order they are returned, which is deterministic for the same query against the same database state.

### 12.10 Replay Environment Requirements

All replay environments — developer workstations, CI runners, staging, production integration tests — MUST produce identical replay outcomes. This requires:

1. The in-memory database mock used by the replay harness MUST implement the exact same query interface as the production database driver, without optimization that reorders results.
2. The replay harness MUST be isolated from the host system timezone (`TZ = 'UTC'` in the harness environment; PRE does not use system timezone but infrastructure code might).
3. The replay harness MUST use the same floating-point rounding precision as the production environment.
4. Language runtime version differences MUST be documented and verified not to affect output.

If two replay environments produce different results for the same packet, the cause is a violation of one of the above constraints, not a legitimate behavioral difference. The investigation MUST identify which constraint is violated and correct it.

---

## 13. Human Review Workflow

### 13.1 Replay Divergence Cannot Be Auto-Approved

When the replay harness detects a divergence — a corpus packet that produces different output with the current implementation — no automated system may approve, suppress, or resolve that divergence. Human review is required. This is not a procedural preference; it is a constitutional requirement.

The reasoning: a replay divergence is either (a) an unintended regression — the implementation is wrong — or (b) an intentional behavioral change — the specification has been amended. Determining which requires understanding the behavioral semantics of the change. No static analysis or automated comparison can make that determination reliably.

### 13.2 Replay Diff Review Process

When a replay divergence is detected in CI:

1. **Automated output:** The replay harness produces a `ReplayDiffReport` for each failing packet:
   - `packet_id`, `scenario_id`, `description`
   - `expected_output` (from corpus)
   - `actual_output` (from current implementation)
   - `divergence_fields` (specific fields where actual ≠ expected)
   - `divergence_class` (see Appendix C)
   - `expected_checksum`, `actual_checksum`

2. **Engineer review:** The PR author reviews the diff and determines: Is this an unintended regression or an intentional change?

3. **Unintended regression:** PR author fixes the implementation. CI re-runs. Divergence must be resolved before merge.

4. **Intentional change:** PR author initiates the retirement process (Section 10.3) in a separate PR. The implementation change PR is blocked until the retirement PR is merged and CI passes.

5. **Tolerated difference:** If the divergence falls in the tolerated taxonomy (Section 9.4), the PR author documents this in the PR description and a reviewer confirms. The CI gate MUST be updated to exclude the tolerated field from the comparison (not suppress the comparison entirely).

### 13.3 Semantic Equivalence Review

Some divergences may be structurally present but semantically equivalent — for example, two different SWRR orderings that produce the same content frequency distribution. These are NOT tolerated differences from the corpus perspective. The corpus captures a specific, deterministic ordering. Any different ordering is a behavioral divergence.

If two orderings are genuinely equivalent and the ordering difference is considered acceptable, the correct resolution is to standardize on one ordering (the existing corpus ordering), verify the implementation produces that ordering, and pass CI. Not to declare the two orderings "equivalent" and suppress the comparison.

### 13.4 Constitutional Escalation Path

If a replay divergence review reveals that the divergence is caused by a bug that also constitutes an INV-x or FP-x violation, the escalation path is:

1. Divergence classified as `CONSTITUTIONAL_BREACH` (Appendix C, Class 4).
2. PR blocked immediately. No path to merge.
3. P0 incident created if the divergence is present in production (not just in test).
4. Root cause analysis conducted.
5. Implementation corrected.
6. Corpus verified at 100%.
7. PR re-reviewed and merged.

### 13.5 Incident Replay Review Cadence

The quarterly replay audit (VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §12.5) requires human review of the full corpus pass rate and a Quarterly Replay Audit Report. The report is reviewed by at least two engineers, one of whom MUST be the current owner of the PRE implementation.

The review evaluates:
- Total corpus size and growth trend
- Pass rate (expected: 100% for active corpus)
- Coverage assessment (Appendix A minimum set — all present?)
- Any fixtures approaching retirement (have their scenarios been superseded by specification changes?)
- Any incidents in the quarter that have not yet been promoted to corpus fixtures

The quarterly review produces a written report. The report is retained permanently alongside the replay audit artifacts.

---

## 14. Future Extraction and Distribution Safety

### 14.1 The Extraction Constraint

The replay corpus is the governing criterion for service extraction safety. An extraction that passes the full corpus is valid. An extraction that fails any corpus packet is invalid until the regression is resolved. There are no exceptions.

This constraint applies regardless of whether the failing packet represents a scenario that occurs in production. The corpus is the behavioral specification. Failing the behavioral specification is failing the extraction, period.

### 14.2 Replay Parity Across Service Extraction

Before any PRE extraction event (PRE moved from the monolith to a standalone network service), the following sequence MUST be executed:

1. Run the full corpus against the pre-extraction implementation. Record pass rate (expected: 100%). Produce an Extraction Pre-Baseline Report.

2. Implement the extracted PRE service.

3. Run the full corpus against the extracted implementation using the replay harness configured to call the extracted service's HTTP endpoint (not an in-process function call). The replay harness translates each `ReplayInput` into the appropriate HTTP request and validates the `PRE_Output` response.

4. Pass rate MUST be 100%. Any failure halts the extraction.

5. Produce an Extraction Post-Baseline Report documenting: implementation differences, corpus pass rate, any tolerated differences (which at this stage should be zero), performance comparison.

6. Capture a new set of cross-version compatibility fixtures (COMPAT class) representing the extracted implementation's behavior at extraction milestone.

### 14.3 Distributed Replay Equivalence

When PRE is horizontally scaled (multiple instances), the replay guarantee extends across instances: identical inputs MUST produce identical outputs regardless of which instance handles the request.

The corpus provides the test for this: run the same corpus packet against each instance independently. All instances MUST produce the same `output_hash`. Any instance that produces a different hash is non-conformant.

This test MUST be part of the deployment verification for any horizontally-scaled PRE configuration.

### 14.4 Horizontal Scaling Determinism

Distributed deployment introduces two specific risks to replay equivalence:

**Risk 1 — Replica lag:** If different PRE instances read from different database replicas with different lag, they may see different `SystemState` for the same `(screen_id, at)`. The corpus does not test this directly — corpus replay uses a sealed `SystemStateSnapshot`. Lag monitoring (ENGINEERING-CONSTITUTION-v1.md §27.5) is the operational control.

**Risk 2 — In-process state sharing:** If PRE instances share any mutable in-process state (caches, counters, connection pools), concurrent invocations may produce different outputs depending on shared state. The PRE function MUST be re-entrant and share no mutable state (INV-1, ENGINEERING-CONSTITUTION-v1.md §16.1). The corpus's determinism property test (EDGE fixtures for concurrent invocation) verifies this.

### 14.5 Cache-Independent Replay Guarantees

The replay harness does not use the manifest cache. It calls PRE directly with a sealed `SystemStateSnapshot` that represents the database state, bypassing the cache entirely. This design ensures that corpus fixtures prove PRE behavior independently of cache state.

This independence is intentional: the cache is an acceleration layer, not an authority (ENGINEERING-CONSTITUTION-v1.md §7.1). PRE's correctness must be demonstrable without the cache. The corpus demonstrates this.

In production, the cache accelerates the delivery of PRE-computed results. In replay, the cache is absent. The outputs must be identical.

---

## 15. Corpus Longevity Rules

### 15.1 Five-Year Compatibility Expectation

The canonical corpus MUST remain replayable across a minimum of five years from the ratification date of this document. Fixtures authored in 2026 MUST be replayable by the replay harness of 2031, even if the PRE implementation language has changed and the infrastructure has been replaced.

Five-year compatibility requires:

1. **Stable serialization:** The canonical serialization rules (Section 3.4) MUST NOT change in a way that alters the serialized form of existing fixture data. If serialization rules must change for new fixtures, the change is a major schema version increment, and old fixtures are re-hashed under the old schema version rules.

2. **Stable algorithm constants:** The FNV-1a constants, SWRR algorithm definition, SYSTEM_FALLBACK_ITEM content, and SYSTEM_EMERGENCY_FALLBACK content are constitutionally fixed. Changes require constitutional amendment.

3. **Stable field semantics:** Fields in `ReplayPacket`, `ReplayInput`, and `PRE_Output` retain their documented semantics across schema versions. Fields are added in minor versions; fields are not removed or reinterpreted without a major version.

4. **Harness compatibility:** The replay harness MUST support all major schema versions for which active packets exist. Harness versions are tagged alongside corpus milestones.

### 15.2 Schema Migration Rules

When the `ReplayPacket` schema changes in a way that requires migration of existing packets:

1. Define the migration as a pure transformation: `migrate(old_packet) → new_packet`.
2. The transformation MUST be deterministic and reversible (or explicitly documented as irreversible with justification).
3. Apply the transformation to all packets in the corpus.
4. Verify that the migrated packets produce the same `output_hash` as the original packets (the behavioral content must be unchanged).
5. Update `packet_version` in all migrated packets.
6. Recompute `packet_hash` for all migrated packets.
7. Commit the migration as a single atomic corpus operation with a migration record.

Migrations MUST NOT alter the `expected_output` of any packet. If a migration would alter `expected_output`, it is not a schema migration — it is a behavioral change requiring the retirement process.

### 15.3 Replay Preservation Strategy

To ensure long-term replayability independent of the production system's evolution:

1. **Corpus snapshots:** At each quarterly audit, a complete corpus snapshot (all active and archived packets) is exported to a standalone archive. The archive includes the corpus tooling source code at that version.

2. **Harness versioning:** The replay harness is tagged with the corpus schema version it supports. Tagged versions are retained permanently.

3. **Docker image archival:** A Docker image containing the replay harness and all dependencies is built at each quarterly milestone. This image is retained as a self-contained replay environment that will execute correctly regardless of future dependency changes.

4. **Documentation freeze:** At each schema major version, a documentation snapshot of this document is included in the archive. The archive is self-contained — no external documentation reference is required.

### 15.4 Archival Requirements

The corpus store MUST be:

- Backed up daily with integrity verification (SHA-256 manifest of all active packet files).
- Replicated to at least two geographically separated storage locations.
- Accessible to engineers with production clearance without requiring live system access (the corpus is not in the production database; it is in version control and backup storage).
- Restorable from backup within 4 hours (RTO for corpus store failure).

Backup failure is a WARNING-severity alert. Corpus integrity failure (any packet file hash does not match stored hash) is a CONSTITUTIONAL_BREACH alert.

### 15.5 Old Fixtures Remain Replayable Indefinitely

There is no retention limit on corpus fixtures. A fixture added in 2026 to capture a DST edge case remains an active regression guard in 2031, 2036, and beyond. The argument "this scenario is too old to be relevant" is never valid. The corpus accumulates knowledge; it does not deprecate it.

The only mechanism by which a fixture becomes inactive is the retirement process (Section 10.3), which requires a constitutional behavioral change and produces a permanent archived record. Time alone never causes a fixture to become inactive.

---

## 16. Appendix A — Minimum Mandatory Golden Fixtures

The following table defines the minimum set of golden fixtures that MUST be present in the corpus at all times. This is a minimum; additional fixtures SHOULD be added to cover additional resolution paths, content-mix combinations, and behavioral nuances.

| Fixture ID | Behavioral Scenario | Resolution Level | Key Invariants | Specification Refs |
|------------|--------------------|-----------------|--------------|--------------------|
| GOLD-001 | Single-screen, area-targeted campaign, no overrides | LEVEL_3 | INV-2, INV-3, INV-6, INV-10 | PRE §6, §15, §16 |
| GOLD-002 | Area inheritance: screen inherits from area-level schedule | LEVEL_3 | INV-6, INV-5 | PRE §5.5 |
| GOLD-003 | TV group operational override terminates campaign | LEVEL_1 | INV-5, INV-8 | PRE §6 STEP_3 |
| GOLD-004 | Screen override wins over group override (specificity) | LEVEL_1 | INV-3, INV-5 | PRE §5.2 |
| GOLD-005 | Emergency absolute precedence over all other content | LEVEL_0 | INV-7, INV-8 | PRE §6 STEP_2 |
| GOLD-006 | Emergency with null content_id: SYSTEM_EMERGENCY_FALLBACK | LEVEL_0 | INV-2, INV-7 | PRE §21.7 |
| GOLD-007 | Sponsorship injection below MAX_SPONSOR_CAPACITY | LEVEL_3+4 | INV-6, INV-8 | PRE §11 |
| GOLD-008 | Sponsorship at saturation: proportional reduction | LEVEL_3+4 | INV-3 | PRE §11.4 |
| GOLD-009 | Mandatory campaign protected from non-org-admin suppression | LEVEL_3 | INV-6 | PRE §10.3 |
| GOLD-010 | Structural fallback: area-level fallback schedules | LEVEL_5 | INV-2, INV-5 | PRE §17 |
| GOLD-011 | System Fallback: no content at any tier | LEVEL_5 | INV-2 | PRE §17.3 |
| GOLD-012 | Offline screen: confidence_score = 0.0; correct playlist | LEVEL_3 | INV-3, INV-10 | PRE §13.2 |
| GOLD-013 | Two-campaign weighted SWRR interleaving | LEVEL_3 | INV-3 | PRE §16.2, §16.3 |
| GOLD-014 | Suppression override: campaign filtered; fallback not filtered | LEVEL_2+3 | INV-5, INV-6 | PRE §10 |
| GOLD-015 | Override with no campaign_id (insertion type): no-op | LEVEL_2 | INV-2 | PRE §24.EC-12 |
| GOLD-016 | Venue-local time evaluation: schedule active in venue TZ, inactive in UTC | LEVEL_3 | INV-9 | PRE §8 |
| GOLD-017 | Multiple sponsorship contracts; exclusivity resolution | LEVEL_4 | INV-3 | PRE §11.3 |
| GOLD-018 | Screen status = 'unprovisioned': System Fallback with trace | LEVEL_0 | INV-2 | PRE §4.1 |
| GOLD-019 | Version semantics: identical checksum does not increment version | LEVEL_3 | INV-4 | PRE §19 |
| GOLD-020 | Version semantics: checksum change increments version | LEVEL_3 | INV-4 | PRE §19 |
| GOLD-021 | content_mix sums exactly to 1.0 (tolerance ±0.001) | LEVEL_3+4 | INV-3 | PRE §12.2 |
| GOLD-022 | FNV-1a checksum Test Vector 1 (Appendix B, PRE spec) | Any | INV-3 | PRE Appendix B |
| GOLD-023 | FNV-1a checksum Test Vector 2: item ordering matters | Any | INV-3 | PRE Appendix B |
| GOLD-024 | FNV-1a checksum Test Vector 3: data key ordering | Any | INV-3 | PRE Appendix B |
| GOLD-025 | FNV-1a checksum Test Vector 4: source field excluded | Any | INV-3 | PRE Appendix B |
| GOLD-026 | valid_until: clamped to MIN_VALID_DURATION when all boundaries past | LEVEL_3 | INV-3 | PRE §14.1 |
| GOLD-027 | Emergency cleared: non-emergency content resumes | LEVEL_3 | INV-7 | PRE §22.2 |
| GOLD-028 | Midnight-crossing override: active post-midnight, inactive pre-start | LEVEL_1 | INV-3, INV-9 | PRE §7 |
| GOLD-029 | Fallback schedule not suppressed by suppression override | LEVEL_3 | INV-2 | PRE §10.4 |
| GOLD-030 | Missing content_id reference: skip item, continue resolution | LEVEL_3 | INV-2 | PRE §21.3 |

**Mandatory edge-case fixtures:**

| Fixture ID | Edge Case | Specification Ref |
|------------|-----------|------------------|
| EDGE-001 | EC-1: Zero-duration schedule window | PRE §24.EC-1 |
| EDGE-002 | EC-2: Two overrides same millisecond | PRE §24.EC-2 |
| EDGE-003 | EC-3: Campaign one item, min_separation | PRE §24.EC-3 |
| EDGE-004 | EC-4: Midnight-crossing + DST fall-back | PRE §24.EC-4 |
| EDGE-005 | EC-5: Midnight-crossing + DST spring-forward | PRE §24.EC-5 |
| EDGE-006 | EC-6: PRE invoked mid-screen-assignment | PRE §24.EC-6 |
| EDGE-007a/b | EC-7: Emergency activated during PRE window (two-packet) | PRE §24.EC-7 |
| EDGE-008 | EC-8 (extended): Leap day schedule | This document §5.9 |
| EDGE-009 | EC-9: Exact-boundary timestamps (four sub-cases) | This document §5.10 |
| EDGE-010 | EC-10: Empty campaign window | PRE §24.EC-10 |
| EDGE-011 | EC-11: Simultaneous overrides at same specificity | PRE §24.EC-11, §9.2 |
| EDGE-012 | EC-12: Override with no campaign_id | PRE §24.EC-12 |
| EDGE-013 | EC-13: Sponsor saturation at exactly MAX_SPONSOR_CAPACITY | This document §5.14 |
| EDGE-014 | EC-14: Override with valid_until in past | PRE §14.1 |
| EDGE-015 | Stale confidence degradation curve (6 sub-cases) | PRE §13.2 |

---

## 17. Appendix B — Replay Packet Schema

This appendix provides the complete canonical replay packet schema in JSON Schema draft-2020-12 format, suitable for implementation of packet validation tooling.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://clubhub.tv/schemas/replay-packet-v1.0.0.json",
  "title": "ReplayPacket",
  "type": "object",
  "required": [
    "packet_id", "packet_version", "corpus_class",
    "captured_at", "capture_source", "captured_by",
    "pre_impl_version", "constitution_version",
    "description", "invariants_under_test", "specification_refs",
    "input", "expected_output",
    "input_hash", "output_hash", "packet_hash",
    "status"
  ],
  "additionalProperties": false,
  "properties": {
    "packet_id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v4; immutable after creation"
    },
    "packet_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semver of replay packet schema specification"
    },
    "corpus_class": {
      "type": "string",
      "enum": [
        "golden", "edge_case", "failure_state", "entropy",
        "chaos", "historical_regression", "cross_version_compat"
      ]
    },
    "captured_at": {
      "type": "integer",
      "description": "UTC milliseconds; wall-clock at capture time"
    },
    "capture_source": {
      "type": "string",
      "enum": [
        "manual_authored", "property_shrink",
        "incident_capture", "production_sample", "milestone_baseline"
      ]
    },
    "captured_by": { "type": "string" },
    "pre_impl_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "constitution_version": {
      "type": "string",
      "description": "e.g. 'v1'"
    },
    "incident_id": {
      "type": ["string", "null"],
      "description": "Present only for historical_regression class"
    },
    "milestone_tag": {
      "type": ["string", "null"],
      "description": "Present only for cross_version_compat class"
    },
    "description": {
      "type": "string",
      "minLength": 20,
      "description": "Human-readable behavioral scenario description"
    },
    "invariants_under_test": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "e.g. ['INV-3', 'INV-7']"
    },
    "specification_refs": {
      "type": "array",
      "items": { "type": "string" },
      "description": "e.g. ['PRE §8.3', 'CONSTITUTION §14.3']"
    },
    "input": {
      "type": "object",
      "required": ["screen_id", "at", "at_iso8601", "system_state"],
      "additionalProperties": false,
      "properties": {
        "screen_id": { "type": "string" },
        "at": {
          "type": "integer",
          "description": "UTC milliseconds; value passed to PRE.resolve()"
        },
        "at_iso8601": {
          "type": "string",
          "description": "Informational only; not used in computation"
        },
        "system_state": { "$ref": "#/$defs/SystemStateSnapshot" }
      }
    },
    "expected_output": { "$ref": "#/$defs/PRE_Output" },
    "input_hash": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}$",
      "description": "FNV-1a 32-bit hex of canonicalizeJson(input)"
    },
    "output_hash": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}$",
      "description": "FNV-1a 32-bit hex of canonicalizeJson(expected_output)"
    },
    "packet_hash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$",
      "description": "SHA-256 hex of canonicalizeJson(packet minus packet_hash)"
    },
    "status": {
      "type": "string",
      "enum": ["active", "archived"]
    },
    "archived_at": { "type": ["integer", "null"] },
    "archived_reason": { "type": ["string", "null"] },
    "archived_by": { "type": ["string", "null"] },
    "superseded_by": { "type": ["string", "null"], "format": "uuid" },
    "retirement_record_id": { "type": ["string", "null"], "format": "uuid" }
  },
  "$defs": {
    "SystemStateSnapshot": {
      "type": "object",
      "required": ["screen", "venue", "organization",
                   "overrides", "schedules", "campaigns",
                   "content_items", "sponsorships"],
      "properties": {
        "screen": { "type": "object" },
        "tv_group": { "type": ["object", "null"] },
        "area": { "type": ["object", "null"] },
        "venue": {
          "type": "object",
          "required": ["id", "timezone"],
          "properties": {
            "timezone": {
              "type": "string",
              "description": "IANA timezone identifier"
            }
          }
        },
        "organization": { "type": "object" },
        "emergency": { "type": ["object", "null"] },
        "overrides": { "type": "array" },
        "schedules": { "type": "array" },
        "campaigns": { "type": "array" },
        "content_items": { "type": "array" },
        "sponsorships": { "type": "array" },
        "last_delivery": { "type": ["object", "null"] }
      }
    },
    "PRE_Output": {
      "type": "object",
      "required": [
        "screen_id", "timestamp", "active_playlist", "content_mix",
        "reason_trace", "confidence_score", "valid_until",
        "resolution_level", "is_fallback"
      ],
      "additionalProperties": false,
      "properties": {
        "screen_id": { "type": "string" },
        "timestamp": { "type": "integer" },
        "active_playlist": {
          "type": "array",
          "items": { "$ref": "#/$defs/PlaylistItem" }
        },
        "content_mix": { "$ref": "#/$defs/ContentMix" },
        "reason_trace": {
          "type": "array",
          "items": { "type": "string" }
        },
        "confidence_score": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 1.0,
          "multipleOf": 0.0001
        },
        "valid_until": { "type": "integer" },
        "resolution_level": {
          "type": "integer",
          "minimum": 0,
          "maximum": 6
        },
        "is_fallback": { "type": "boolean" }
      }
    },
    "PlaylistItem": {
      "type": "object",
      "required": ["content_id", "type", "data", "duration_ms",
                   "priority", "source"],
      "properties": {
        "content_id": { "type": "string" },
        "type": { "type": "string" },
        "data": { "type": "object" },
        "duration_ms": {
          "type": "integer",
          "minimum": 3000
        },
        "priority": { "type": "integer" },
        "source": {
          "type": "string",
          "enum": ["campaign", "override", "emergency",
                   "sponsor", "fallback", "system"]
        },
        "campaign_id": { "type": ["string", "null"] },
        "schedule_id": { "type": ["string", "null"] }
      }
    },
    "ContentMix": {
      "type": "object",
      "required": ["campaign_pct", "sponsor_pct", "override_pct",
                   "fallback_pct", "system_pct"],
      "properties": {
        "campaign_pct":  { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "sponsor_pct":   { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "override_pct":  { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "fallback_pct":  { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "system_pct":    { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "description": "All five fields MUST sum to 1.0 ± 0.001"
    }
  }
}
```

---

## 18. Appendix C — Forbidden Replay Divergence Types

Every divergence detected by the replay harness MUST be classified into exactly one of the five classes defined here. Classification determines the response path: whether the PR is blocked, what investigation is required, and who must be involved in resolution.

### 18.1 Class 0: Cosmetic Divergence (Tolerated)

**Definition:** Difference in output fields that are explicitly excluded from the behavioral guarantee. These fields are expected to differ across implementations and do not constitute regression.

**Fields in this class:**
- `computed_ms` — execution timing; not behavioral
- `at_iso8601` in packet metadata — informational only
- Additional trace entries in `reason_trace` that supplement rather than contradict existing entries

**Response:** Document in PR that the divergence is Class 0. Reviewer confirms. No CI block. The comparison tool MUST be updated to exclude the specific field, not to suppress comparison entirely.

**Example:** New implementation adds `"L4:SPONSORSHIP_CONTRACTS_EVALUATED:count=1"` to `reason_trace` while old implementation had `"L4:SPONSORSHIP_INJECTED:1_item"`. If both entries are present and the playlist output is identical, this is Class 0.

### 18.2 Class 1: Tolerated Divergence (Reviewed, No Block)

**Definition:** Difference in output fields that have permitted variation within defined bounds, where the variation is within the tolerance documented in Section 9.4.

**Fields in this class:**
- `valid_until` — may differ by up to MIN_VALID_DURATION (5,000ms) between implementations due to boundary computation precision
- `confidence_score` — may differ by ±0.0001 due to floating-point rounding differences (where rounding conventions differ but both are within spec)

**Response:** Document in PR. Reviewer confirms the divergence is within tolerance bounds. CI gate updated to apply tolerance comparison for the specific field. The divergence is recorded but does not block merge.

**Example:** Old implementation computes `valid_until = at + 86399000`; new implementation computes `valid_until = at + 86400000` due to a boundary condition in schedule end-time processing. Both are within `[at + MIN_VALID_DURATION, at + MAX_VALID_DURATION]`. Class 1 if the difference is documented and within tolerance.

### 18.3 Class 2: Warning Divergence (Blocks Until Resolved or Retired)

**Definition:** Difference in behavioral output fields (`active_playlist` order, `content_mix`, `is_fallback`, `resolution_level`, `checksum`) that is potentially intentional — the implementation may have been intentionally changed — but has not yet been classified through the retirement process.

**Response:** PR is blocked. The PR author MUST determine whether this is an unintended regression (fix the implementation) or an intentional change (initiate retirement process). The block is lifted when either the implementation is corrected (and corpus passes) or the retirement process is complete and replacement fixtures pass.

**Example:** New implementation produces a different SWRR ordering for a two-campaign scenario. The playlist content is the same but the sequence is different, producing a different checksum. This is a behavioral divergence. Either the implementation has a SWRR bug (fix it) or the SWRR algorithm specification was intentionally changed (retire and replace fixture).

### 18.4 Class 3: Constitutional Divergence (Blocks; Escalates to Review)

**Definition:** Difference in behavioral output that directly violates one of the PRE invariants INV-1 through INV-10 or one of the forbidden states FORBIDDEN-1 through FORBIDDEN-10.

**Response:** PR blocked immediately. A constitutional review is initiated, separate from the PR. The review determines whether this is an implementation bug or a specification gap requiring amendment. P0 incident created if the divergence is present in production (not just in test). No merge until constitutional review is resolved.

**Examples:**
- Replay produces non-null output when emergency is active and non-emergency content appears → INV-7 violation → Class 3
- Replay produces empty `active_playlist` → INV-2 violation → Class 3
- Two calls with identical inputs produce different checksums → INV-3 violation → Class 3
- Replay harness detects that PRE attempted a write operation during resolution → INV-1 violation → Class 3

### 18.5 Class 4: Catastrophic Divergence (All-Stop; Incident)

**Definition:** Divergence that indicates the replay guarantee itself has been compromised — not just that PRE produces wrong output, but that the corpus, replay harness, or integrity verification system cannot be trusted.

**Examples:**
- `packet_hash` verification fails for an existing corpus packet (corpus corruption)
- Replay harness produces different results on two consecutive runs with no changes (harness nondeterminism)
- Corpus index and corpus files are inconsistent (index references packets that don't exist, or files exist with no index entry)
- Two different packets with the same `packet_id` are found in the corpus

**Response:** All-stop. No deploys. No merges. Incident created. Root cause analysis before any corpus activity resumes. The integrity of the replay system itself must be established before it can be trusted as a regression gate.

### 18.6 Classification Decision Tree

```
DIVERGENCE DETECTED
      │
      ▼
Is divergence in a field explicitly listed as tolerated (§9.4)?
      │
   YES ──→ Class 0 (Cosmetic) or Class 1 (Tolerated)
      │     Document, confirm with reviewer, update comparison tool
      │
   NO  ──→ Does divergence violate INV-x or FORBIDDEN-x?
               │
            YES ──→ Does divergence indicate corpus/harness corruption?
                       │
                    YES ──→ Class 4 (Catastrophic) → All-stop
                       │
                    NO  ──→ Class 3 (Constitutional) → Escalate to review
               │
            NO  ──→ Is divergence in behavioral output field (checksum, playlist, is_fallback)?
                       │
                    YES ──→ Class 2 (Warning) → Block PR; investigate
                       │
                    NO  ──→ Re-examine; may be Class 0 or 1
```

---

*Document status: Ratified. This document constitutes the permanent behavioral anchor for ClubHub TV's PRE implementation across all versions, deployments, and future evolutions. The canonical corpus governed by this document grows monotonically. No fixture governed by this document is ever deleted. Amendments require the constitutional amendment process defined in ENGINEERING-CONSTITUTION-v1.md §30.*
