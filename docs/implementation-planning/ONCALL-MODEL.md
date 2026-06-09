# On-Call Model

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26

---

## Overview

The ClubHub TV on-call model has three tiers aligned with the platform's role hierarchy.
Each tier owns a specific scope of incidents. Escalation flows upward through the tiers —
a Tier 1 responder who cannot resolve an incident escalates to Tier 2, and so on.

The on-call model is a requirement, not a preference. The platform has constitutional
enforcement that can freeze all mutations without notice. If no PLATFORM_ADMIN is
reachable within 10 minutes of a P1 incident, the platform remains frozen until one is.
This is an operational risk, not a technical one.

---

## On-Call Tiers

### Tier 1: VENUE_OPERATOR (venue-level)

**Scope:** Incidents affecting their specific venue's screens and content.

**Coverage hours:** Venue operating hours only. VENUE_OPERATOR is not expected to be
on-call outside of hours their venue is open. If an incident occurs outside operating
hours, it escalates directly to Tier 2 (REGIONAL_MANAGER).

**Incident types:**
- VENUE_EMERGENCY (triggered for their venue)
- CRITICAL entropy alerts for their venue's screens
- P3 incidents scoped to their venue
- Black screen reports from venue staff

**Response SLA:** 15 minutes during venue operating hours.

**What VENUE_OPERATOR does not handle:**
- Cross-venue incidents
- Constitutional state changes
- Canary stage decisions
- Anything requiring REGIONAL_MANAGER or above role

**Escalation path:** VENUE_OPERATOR → REGIONAL_MANAGER

---

### Tier 2: REGIONAL_MANAGER (regional-level)

**Scope:** Incidents affecting multiple venues in their region, or escalated single-venue
incidents that VENUE_OPERATOR cannot resolve.

**Coverage hours:** 24/7 for their region on a rotating schedule. At least one
REGIONAL_MANAGER per region must be reachable at all times.

**Incident types:**
- Fleet emergencies (multi-venue screens going dark)
- Multi-venue or region-wide entropy alerts
- P2 incidents (CLASS_3 divergence) — REGIONAL_MANAGER is the initial contact for
  enterprise-level issues until ENTERPRISE_ADMIN is reached
- Escalated P3 incidents (unresolved after 2 hours)
- Heartbeat loss across multiple venues in the region

**Response SLA:** 30 minutes at all times.

**What REGIONAL_MANAGER does not handle:**
- Constitutional state changes (EMERGENCY_FREEZE, READ_ONLY)
- Canary advancement decisions
- Corpus signing or rollback without ENTERPRISE_ADMIN involvement

**Escalation path:** REGIONAL_MANAGER → PLATFORM_ADMIN (for P1 and P2), or
ENTERPRISE_ADMIN (for corpus and configuration decisions).

---

### Tier 3: PLATFORM_ADMIN (platform-level)

**Scope:** Platform-wide incidents, constitutional integrity events, and any situation that
requires constitutional console access.

**Coverage hours:** 24/7 global, continuously. There is no time window where a
PLATFORM_ADMIN is not required to be reachable. This is non-negotiable because
EMERGENCY_FREEZE cannot be exited without a PLATFORM_ADMIN.

**Minimum staffing:** 2 PLATFORM_ADMINs with on-call records in the system at all times.
A rotation of 2 means each person is on-call half the time with no backup. The minimum
recommended rotation size is 3 people.

**Incident types:**
- P1 incidents: EMERGENCY_FREEZE, CLASS_4/CLASS_5 events
- Manual GlobalConstitutionalBreaker trips (own action, by definition)
- EMERGENCY_FREEZE exit procedure
- P2 incidents escalated from REGIONAL_MANAGER
- Constitutional boundary violations
- Corpus signing key compromise
- Any incident where the constitutional console must be accessed

**Response SLA:** 10 minutes. If the on-call PLATFORM_ADMIN does not acknowledge within
10 minutes, all PLATFORM_ADMINs are paged simultaneously.

**No escalation path.** PLATFORM_ADMIN is the top of the escalation chain. If a
PLATFORM_ADMIN cannot resolve an incident, they bring in other PLATFORM_ADMINs —
there is no higher tier to escalate to.

---

## On-Call Rotation Management

### On-call records are in the system

On-call schedules are recorded in the system as structured on-call records — not in
spreadsheets, not in shared calendars, not in a chat channel. This is required because:

1. The system uses on-call records to route CRITICAL alerts to the correct person.
2. PLATFORM_ADMIN coverage gaps are surfaced by the system automatically.
3. Handover records are system-recorded, not chat-recorded.

Each on-call record contains:
- `principal_id` — the user in the system
- `tier` — VENUE_OPERATOR, REGIONAL_MANAGER, or PLATFORM_ADMIN
- `coverage_start` — UTC timestamp
- `coverage_end` — UTC timestamp
- `contact_phone` — verified phone number for this coverage window
- `contact_email` — verified email
- `backup_principal_id` — the person to contact if primary does not respond in SLA

### Coverage gap detection

The system alerts if any of the following conditions exist for any upcoming hour in the
next 7 days:
- Zero PLATFORM_ADMIN coverage (immediate CRITICAL alert to all PLATFORM_ADMINs)
- Only 1 PLATFORM_ADMIN coverage (WARNING — single point of failure risk)
- Zero REGIONAL_MANAGER coverage for any active region
- Zero VENUE_OPERATOR coverage for a venue during its stated operating hours

PLATFORM_ADMIN is responsible for resolving coverage gaps. The system surfaces them; a
human must fill them.

### Minimum PLATFORM_ADMIN coverage rule

At all times, at minimum 2 PLATFORM_ADMINs must have overlapping on-call coverage. This
means:
- If PLATFORM_ADMIN A is on-call from 00:00 to 12:00 UTC and PLATFORM_ADMIN B is on-call
  from 12:00 to 00:00 UTC, there is overlap only at the handover moments — this is
  insufficient. Overlap should be ≥ 1 hour at each handover.
- If there are only 2 PLATFORM_ADMINs in the rotation, each one is on-call 24/7 with no
  off-call time — this is not sustainable. See the Wave 1 decision below.

---

## Contact Information Staleness

On-call contact information that is more than 30 days old is considered unverified and
is flagged in the system. Stale contact information is a production risk: an alert may
go to an outdated phone number and reach no one.

**Validation requirement:** Each PLATFORM_ADMIN must confirm their contact information
is current at least monthly. The system requires clicking "confirm my contact info is
current" in the PLATFORM_ADMIN console. This action is recorded with a timestamp.

**What happens with stale records:**
- The system surfaces a WARNING on the on-call coverage dashboard.
- The stale PLATFORM_ADMIN receives a reminder notification.
- After 45 days without validation, the record is flagged in the weekly operational
  report as an acknowledged production risk.

Stale on-call records are not an automatic deployment block — they are a risk that
PLATFORM_ADMIN acknowledges and owns. But if a P1 incident occurs and an alert goes
to a stale phone number, the post-incident review will document this as a contributing
factor.

---

## Emergency Escalation Timing

### P1 (EMERGENCY_FREEZE or CLASS_4)

1. On-call PLATFORM_ADMIN receives immediate page.
2. If no acknowledgement in **10 minutes**: all PLATFORM_ADMINs receive simultaneous page.
3. No further escalation chain — this is the top tier.
4. If no PLATFORM_ADMIN can be reached: platform remains in EMERGENCY_FREEZE. Screens
   continue serving from player cache. This is not a catastrophic failure — the 72h
   autonomy window provides time to reach a PLATFORM_ADMIN.

### P2 (CLASS_3 / CONSTITUTIONAL_RISK)

1. ENTERPRISE_ADMIN and REGIONAL_MANAGER receive CRITICAL alert simultaneously (the roles
   are different but both need to be aware).
2. If ENTERPRISE_ADMIN does not acknowledge in **30 minutes**: PLATFORM_ADMIN is paged.
3. PLATFORM_ADMIN involvement at P2 is oversight, not primary responder — ENTERPRISE_ADMIN
   leads the investigation.

### P3 (CRITICAL entropy)

1. VENUE_OPERATOR receives notification (alert, not page, during operating hours).
2. If unresolved after **2 hours**: REGIONAL_MANAGER escalates.
3. P3 does not become a page unless it escalates to P2 (e.g., entropy pattern suggests
   systemic corpus integrity problem).
4. P3 outside operating hours: goes directly to REGIONAL_MANAGER as notification (not page).

---

## Handover Protocol

On-call handover is a system-recorded event, not a chat message. The outgoing
PLATFORM_ADMIN must complete the handover checklist in the PLATFORM_ADMIN console,
and the incoming PLATFORM_ADMIN must acknowledge receipt. Handover is not complete until
the incoming acknowledgement is recorded.

### Outgoing PLATFORM_ADMIN must document

1. **Current constitutional state.** If the state is anything other than HEALTHY, document
   what it is, why it is in that state, and what is being done about it.

2. **Open incidents.** List all incidents with current status, last action taken, and
   next step. Include the incident ID for each one.

3. **Pending canary promotions.** If any corpus canary is in progress, document:
   - Current stage
   - Stage start time (and when the minimum duration will be met)
   - Next gate evaluation time
   - Who approved the last stage advancement

4. **Scheduled maintenance.** Any maintenance windows in the next 24 hours: what is
   planned, when, who is executing it.

5. **Known risks or investigations.** Anything that is not an open incident but warrants
   attention — elevated entropy frequency, a player with intermittent heartbeat, a recent
   unusual CLASS_1 pattern.

### Incoming PLATFORM_ADMIN acknowledgement

Incoming PLATFORM_ADMIN must:
1. Read the handover document in the system
2. Click "acknowledge handover" — this records their `principal_id` and timestamp
3. Confirm they have the correct contact information for the outgoing PLATFORM_ADMIN
   (in case a question arises after handover)

Handover is not complete — and the outgoing PLATFORM_ADMIN is not off-call — until
the incoming acknowledgement is recorded.

---

## Wave 1 Decision: PLATFORM_ADMIN Rotation Size

**This decision must be made before Wave 1 ships to production.**

The on-call model requires minimum 2 PLATFORM_ADMINs with overlapping coverage at all
times. The consequences of the decision about rotation size are significant:

**2-person rotation:**
- Each person is effectively on-call 24/7 with one backup.
- High burnout risk within 60-90 days.
- Single coverage gap (one PLATFORM_ADMIN unavailable) immediately creates a coverage
  risk with no backup.
- EMERGENCY_FREEZE RTO becomes dependent on reaching one of two specific people.
- Acceptable only as a temporary Wave 1 state with a commitment to expand to 3+
  within 60 days.

**3-person rotation:**
- Each person is on-call approximately 56h per week (⅓ of the time).
- One person unavailable still leaves 2 with overlap.
- Minimum viable for sustained production operation.
- Recommended minimum for Wave 1.

**4+ person rotation:**
- Each person on-call ~42h per week or less.
- Sustainable long-term.
- Target state for fleet-wide rollout.

**Decision to record before Wave 1:**
- How many PLATFORM_ADMINs will be in the initial rotation?
- If fewer than 3: what is the explicit commitment date for expanding to 3?
- Who are the named PLATFORM_ADMINs and have they confirmed availability and contact
  information in the system?
- Is there a written acknowledgement of the coverage risk if fewer than 3?

This is not a technical decision — it is a staffing and risk decision. It must be made
by leadership with full awareness of what EMERGENCY_FREEZE means operationally: no
mutations, no new corpus, no campaign management, until a PLATFORM_ADMIN is reached.
