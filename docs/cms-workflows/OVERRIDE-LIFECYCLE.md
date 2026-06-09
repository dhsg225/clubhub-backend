# Override Lifecycle

**Document type:** Operational workflow specification
**Audience:** VENUE_OPERATOR, REGIONAL_MANAGER, ENTERPRISE_ADMIN, PLATFORM_ADMIN, platform engineers
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, CAMPAIGN-LIFECYCLE.md, CLUBHUB_SYSTEM_CONTRACTS.md, REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

An override is a point-in-time or duration-bound intervention that supersedes the normal PRE resolution waterfall. Overrides are intentional acts — they represent an operator's decision that the resolved content for a specific time window should differ from what the campaign schedule or default corpus would produce.

Overrides resolve at PRE levels L1 (operational override) or L2 (scheduled override) depending on their type, above campaigns (L3) and sponsorships (L4). Emergency overrides resolve at L0 and are covered in EMERGENCY-LIFECYCLE.md.

Every override is a fully replay-auditable event. The `override_id` appears in every ReplayAuditRecord generated while the override is active. This enables forensic reconstruction of exactly what played, when, and under whose authority.

---

## 2. Override Types

### 2.1 IMMEDIATE Override

**PRE Level:** L1 (Operational Override)
**Trigger behavior:** Takes effect at the next PRE resolution tick after creation (typically within seconds)
**Use case:** Unplanned operational need — event running long, unexpected content requirement, staff-initiated programming change
**Duration:** Up to 24 hours (see §3 for authority extensions)

An IMMEDIATE override bypasses SCHEDULED and CAMPAIGN content for its entire duration. Sponsor content at L4 is suppressed during the override window. Compliance content at L1 is NOT suppressed — compliance slots are evaluated separately from the override content and are inserted regardless.

### 2.2 SCHEDULED Override

**PRE Level:** L2 (Scheduled Override)
**Trigger behavior:** Takes effect at a specified future `start_time`
**Use case:** Planned departures from the campaign schedule — recurring events, known content changes, promotional windows
**Duration:** No hard limit, but duration beyond 7 days requires REGIONAL_MANAGER+ authority (see §3)

SCHEDULED overrides are indexed into the PRE schedule at creation time and are visible in preview operations before their start time.

### 2.3 RECURRING Override

**PRE Level:** L2 (Scheduled Override — recurring instance)
**Trigger behavior:** SCHEDULED semantics applied on a repeating schedule (daily, weekly, event-pattern)
**Use case:** Regular events with predictable content requirements — weekly golf tournament, daily happy hour, monthly membership drive
**Duration:** Each instance treated as a separate SCHEDULED override; recurrence series managed as a group

Recurrence series can be cancelled as a group (all future instances) or instance-by-instance. Past instances are immutable — they cannot be retroactively cancelled.

### 2.4 EMERGENCY Override

**PRE Level:** L0 (Emergency Resolution)
**Trigger behavior:** Immediate — takes effect within one resolution tick
**Use case:** Safety-critical operational need — evacuation, compliance breach, incident management
**Duration:** Until explicitly cleared; no automatic expiry

Emergency overrides are governed by EMERGENCY-LIFECYCLE.md. They are documented here only for completeness of the authority model. Emergency override creation bypasses normal approval workflow and has distinct audit semantics.

---

## 3. Override Authority by Role

### 3.1 Authority Matrix

| Role                | Scope          | Max Duration (unilateral) | Extension Approval Required    | Emergency Override |
|---------------------|----------------|---------------------------|--------------------------------|--------------------|
| VENUE_OPERATOR      | Venue-local    | 24 hours                  | REGIONAL_MANAGER co-approval   | No                 |
| REGIONAL_MANAGER    | Regional       | 7 days                    | ENTERPRISE_ADMIN approval      | Yes (venue scope)  |
| ENTERPRISE_ADMIN    | Fleet-wide     | No limit                  | None                           | Yes                |
| PLATFORM_ADMIN      | Platform       | No limit (constitutional) | None                           | Yes                |

### 3.2 Venue-Local Override (VENUE_OPERATOR)

A VENUE_OPERATOR may create overrides that target only screens within their assigned venue. They cannot create overrides that affect screens in other venues even if they have physical access to those screens.

Duration cap: 24 hours without co-approval. To create a venue-local override exceeding 24 hours, the VENUE_OPERATOR must request co-approval from a REGIONAL_MANAGER. The co-approval must be recorded before the override takes effect beyond the 24-hour mark — the system does not retroactively extend overrides. An override at hour 23 without co-approval will automatically expire at hour 24.

### 3.3 Regional Override (REGIONAL_MANAGER)

A REGIONAL_MANAGER may create overrides targeting any venue within their managed region. They cannot create overrides affecting venues in other regions.

Duration cap: 7 days without escalation. Overrides exceeding 7 days require ENTERPRISE_ADMIN approval. The approval must be obtained before day 7; overrides do not auto-extend.

### 3.4 Fleet Override (ENTERPRISE_ADMIN)

An ENTERPRISE_ADMIN may create overrides targeting any venue, region, or the entire fleet under their enterprise. No duration cap. They may also create overrides that modify enterprise-level default content.

### 3.5 Platform Override (PLATFORM_ADMIN)

A PLATFORM_ADMIN may create platform-scope overrides that affect all venues across all enterprises. These are used only in constitutional circumstances (e.g., emergency content mandated by a regulatory authority). Platform overrides are recorded with heightened audit detail and require a platform-level justification record.

---

## 4. Override Resolution — PRE Interaction

### 4.1 Resolution Hierarchy During Override

When an override is active, PRE.resolve() evaluates levels in this order:

```
L0: Emergency content (EMERGENCY_LIFECYCLE.md)
L1: IMMEDIATE and active SCHEDULED/RECURRING overrides   ← Override resolves here
L2: Other SCHEDULED overrides (lower priority than L1 in same window)
L3: Campaign content
L4: Sponsorship content
L5: Venue defaults
L6: Device-local fallback
```

An override at L1 means that for the duration of the override window, PRE does not proceed to evaluate L2-L6 for the same content slot. The override content is authoritative.

### 4.2 Compliance Slot Behavior During Override

Compliance content (L1 compliance classification) is evaluated independently of the override content slot. A compliance slot that falls within an override window is NOT suppressed — the compliance content is inserted as a constitutional requirement regardless of the override. The override content plays in non-compliance slots within the same window.

This means operators cannot use overrides to suppress compliance content. Attempting to configure an override that would fully displace a compliance window produces a validation error: `COMPLIANCE_SLOT_PROTECTED`.

### 4.3 Sponsor Content Behavior During Override

Sponsor content at L4 is suppressed during any L1 or L2 override window. This is expected and documented in SPONSORSHIP-WORKFLOWS.md. The suppression is recorded in the sponsor proof-of-play audit and is visible to SPONSOR_STAKEHOLDER users.

When a VENUE_OPERATOR creates an override that displaces sponsor content, the system:
1. Calculates projected SOV impact for any active sponsorship in the affected screens and window
2. Displays the projected impact to the VENUE_OPERATOR before the override is confirmed
3. Records the acknowledgment on the override creation audit record
4. Notifies any ENTERPRISE_ADMIN responsible for the affected sponsorship if SOV impact exceeds 5% of contracted window

---

## 5. Override Conflict Resolution

### 5.1 Two Active Overrides at Same Scope

When two overrides of the same type target the same screen and overlap in time, the system applies precedence rules:

**Rule 1 — Higher authority wins:** An override created by ENTERPRISE_ADMIN takes precedence over one created by REGIONAL_MANAGER, which takes precedence over VENUE_OPERATOR. The lower-authority override is not cancelled — it remains active and takes effect if the higher-authority override expires or is cancelled.

**Rule 2 — Same authority, newer wins:** If two overrides from actors of equal authority overlap, the newer override (higher `created_at` timestamp) takes precedence for the overlapping window. The older override continues in any non-overlapping portions of its window.

**Rule 3 — Explicit priority field:** Operators may set an explicit `priority` integer on an override (0-100, default 50). If two overrides from equal-authority actors have different priority values, higher priority wins regardless of creation order.

**Rule 4 — Conflict acknowledgment required:** When a new override is created that will conflict with an existing override from an equal-authority actor, the creating operator must explicitly acknowledge the conflict and the precedence outcome. This acknowledgment is recorded on the override creation audit record.

### 5.2 Conflict Notification

The operator who created the lower-precedence override is notified of the conflict and the resulting precedence decision. They are not blocked from their override being created — they are informed that their override will be superseded during the conflicting window.

---

## 6. Override Expiry

### 6.1 Automatic Expiry

Overrides with a defined `end_time` expire automatically at that time. PRE removes the override from L1/L2 at the expiry tick. The next PRE resolution tick evaluates L3 and below normally.

Automatic expiry emits: `override.expired` with `override_id`, `expired_at`, `total_active_duration_s`, `screens_affected[]`.

### 6.2 Manual Expiry

An override may be manually expired before its `end_time` by any actor with authority equal to or greater than the creating actor.

Manual expiry requires a confirmation step: the actor must provide an `expiry_reason` (free text, required) and confirm the action. This prevents accidental cancellation of active overrides.

Audit record: `override.manually_expired` with `override_id`, `expired_by`, `expiry_reason`, `original_end_time`, `actual_end_time`.

### 6.3 Extension Before Expiry

An override may be extended before it expires. Extension authority is the same as creation authority. An extension that would push the override beyond the unilateral authority duration cap requires co-approval (see §3).

If a VENUE_OPERATOR's 24-hour override is at hour 20 and they request a 12-hour extension (total 32 hours), they must obtain REGIONAL_MANAGER co-approval before the extension takes effect. The extension is not applied until co-approval is received.

---

## 7. Override and Replay Audit

Every override creates a durable audit record. The `override_id` is stamped into every ReplayAuditRecord generated by PRE during the override window. This allows forensic reconstruction of override effects:

- **Which screens were affected:** Derived from `override.screen_scope`
- **What content played:** Derived from ReplayAuditRecords with matching `override_id`
- **Who created the override:** Derived from `override.created_by`
- **Why it was created:** Derived from `override.reason` (required field at creation)

Override audit records are append-only and cannot be modified after creation. The `override.reason` field is immutable — operators who create overrides must record the reason at creation time because they cannot amend it afterward.

---

## 8. Override and Shadow/Canary Mode

When a deployment group is in SHADOW_ONLY or canary stage, override behavior is subject to shadow comparison:

- **Override creation in shadow mode:** The override is applied to the PRE path. The shadow comparison captures whether the legacy system would have produced different output during the override window. This is expected to diverge (the override is intentional) — shadow comparison logs the divergence as `EXPECTED_OVERRIDE_DIVERGENCE`, not as a parity failure.

- **Unexpected divergence during override:** If PRE produces different output from the override content (i.e., the override did not resolve at L1 when it should have), this IS a parity failure and triggers shadow divergence alerting.

- **Override audit in canary mode:** During canary stages, override audit records include additional fields: `canary_stage`, `legacy_output_checksum`, `pre_output_checksum`. These fields support canary promotion assessment.

---

## 9. Override Audit Record Reference

| Event                       | Emitted At                   | Required Fields                                                                           |
|-----------------------------|------------------------------|-------------------------------------------------------------------------------------------|
| `override.created`          | Override creation            | override_id, type, created_by, scope, start_time, end_time, reason, sov_impact_acknowledged |
| `override.activated`        | Override takes effect        | override_id, activated_at, screen_ids[], pre_level                                       |
| `override.conflict_resolved`| Conflict acknowledged        | override_id, conflicting_override_id, precedence_rule_applied, acknowledged_by           |
| `override.co_approval_requested` | Duration extension cap reached | override_id, requested_by, extension_duration_s                              |
| `override.co_approved`      | Co-approval received         | override_id, co_approved_by, new_end_time                                                |
| `override.extended`         | Duration extended            | override_id, extended_by, original_end_time, new_end_time                                |
| `override.expired`          | Automatic expiry             | override_id, expired_at, total_active_duration_s, screens_affected[]                    |
| `override.manually_expired` | Manual expiry                | override_id, expired_by, expiry_reason, original_end_time, actual_end_time              |
| `override.emergency_created`| Emergency path               | override_id, created_by, emergency_type, constitutional_basis                            |

All records append-only. Integrity verified by hash-chain in workflow_traces.
