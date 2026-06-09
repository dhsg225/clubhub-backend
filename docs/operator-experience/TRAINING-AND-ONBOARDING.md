# Training and Onboarding

**Version:** 1.0
**Status:** Authoritative
**Scope:** Operator training paths, certification requirements, and competency gates for all four operator roles
**Related:** OPERATOR-MENTAL-LOAD.md, SHIFT-HANDOVER-MODELS.md, RECOVERY-ORIENTED-DESIGN.md

---

## Purpose

Training is the mechanism by which the system's design intent reaches operators as lived operational knowledge. The most carefully designed alert taxonomy, the most honest state display, the most complete handover model — all of these fail if operators do not know how to read them, trust them, or use them.

This document defines training paths that are graduated (complexity unlocks progressively), role-appropriate (each role trains to their actual operational surface), and grounded in real scenarios rather than abstract feature descriptions.

One organizing principle runs through all training: operators learn systems by learning what they do when things go wrong, not when things go right. The happy path is easy. The crisis at midnight with a frozen system and a venue full of people — that is where operational competence is either present or absent.

---

## 1. VENUE_OPERATOR Training Path

### Who Needs This Training

Any person who will have log-in access to the venue operator interface, including bar managers, venue coordinators, assistant managers, and floor supervisors who may need to respond to content alerts.

### Training Philosophy for Venue Operators

Venue operators are not technology users by profession. They have many operational priorities competing for their attention and a finite tolerance for system complexity. Training must be efficient, scenario-driven, and heavily practiced rather than lecture-heavy.

The training goal is not for venue operators to understand the system architecture. It is for them to confidently answer three questions at any moment: Is the system working? What is playing right now? What do I do if something is wrong?

### Level 1 — Day 1 Foundation

**Prerequisites:** None
**Duration:** 2–3 hours
**Required for:** Live system access (read-only initially)

**Topics:**

**System orientation**
- What is ClubHub TV? What does the system do for the venue?
- How content gets to screens: a conceptual walkthrough (no technical detail — "a schedule tells each screen what to play, and the system makes sure that happens")
- The operator's role: monitoring, not managing. Operators watch, respond, and escalate. They do not program the system.

**Basic navigation**
- How to log in, how to log out
- The main dashboard: what is each section for?
- How to check system health (the health indicator — HEALTHY/DEGRADED/etc.)
- How to check what is playing on which screen (screen status view)
- How to find today's schedule

**Reading alerts**
- What an alert looks like, where it appears
- The difference between CRITICAL ("act now"), HIGH ("act today"), and MEDIUM ("act this week")
- What to do if you see a CRITICAL alert: read it, follow the action it specifies, escalate if unclear
- What to do if you see an alert you don't understand: escalate to REGIONAL_MANAGER; do not guess

**Practice exercises (required to pass Level 1):**
1. Log in to the training environment. Find the system health status. Is it HEALTHY or not?
2. Identify which screen is playing which content right now.
3. Navigate to today's schedule. What is scheduled for the 8pm time slot?
4. Locate an active HIGH alert. What does it say? What action does it recommend?
5. Find the escalation contact information (REGIONAL_MANAGER contact).

**Certification gate:** Operator must complete all five exercises successfully. Trainer signs off. Until Level 1 is certified, the operator has read-only access to the live system.

**Learning environment:** Sandbox environment that mirrors the real venue's content library and schedule structure. All scenarios are played out in sandbox; no publishing authority in sandbox.

---

### Level 2 — Week 1 Operational Authority

**Prerequisites:** Level 1 certification
**Duration:** 4–6 hours across the first week (can be spread over multiple sessions)
**Required for:** Publishing authority (creating overrides, publishing campaigns)

**Topics:**

**Campaign management**
- What is a campaign? How does it relate to the schedule?
- How to review a campaign before it goes live: the preview workflow
- How to publish a campaign: the publish confirmation screen and why every field matters
- What happens after publishing: propagation time, confirmation, and what to do if a screen doesn't confirm

**Override creation**
- What is an override and when should you use one? (temporary exception, not a permanent schedule change)
- Override scope: which screens does this affect?
- Override duration: setting the expiry time intentionally (why "no expiry" is a risk)
- Creating an override: walkthrough of the complete flow
- Monitoring an active override: how to confirm it is working
- Override expiry: what happens when it expires, and why expiry warnings exist

**Emergency trigger**
- What is a Level 0 emergency override? When is it appropriate?
- Emergency content: what is the configured emergency content for this venue?
- How to trigger an emergency: the 2-step confirmation flow
- What happens immediately after trigger: which screens are affected, what content appears
- How to clear an emergency: the clearance flow and what you confirm when you clear it
- Practice: every Level 2 trainee must trigger and clear an emergency in the sandbox environment

**Shift handover**
- What is the handover report and why does it matter?
- How to generate a handover report before your shift ends
- How to receive a handover report at the start of your shift
- Emergency acknowledgment: what it means to accept responsibility for an active emergency
- Handover practice: trainees complete a handover from a pre-configured shift state that includes one active emergency and one expiring override

**Practice exercises (required to pass Level 2):**
1. Preview a campaign for tomorrow evening. What is the confidence level of the preview? What would play if no override were active?
2. Create a 2-hour promotional override on the bar screens. Set it to expire at 11pm. Confirm the expiry time is correct in the active override list.
3. Trigger an emergency override in the sandbox. Confirm which screens show the emergency content. Clear the emergency. Confirm screens return to scheduled content.
4. Generate a handover report from the end-of-shift state provided by the trainer. Confirm all six categories are completed.
5. Receive a handover report that includes an active emergency. Complete the acknowledgment flow.

**Certification gate:** Operator must complete all five exercises within the time limits specified by the trainer. Emergency trigger and clearance must be demonstrated live (not just described). Until Level 2 is certified, the operator can view content and alerts but cannot publish campaigns, create overrides, or trigger emergencies.

---

### Level 3 — Month 1 Operational Fluency

**Prerequisites:** Level 2 certification and at least 3 weeks of live operational experience
**Duration:** 3–4 hours
**Required for:** Senior venue operator designation, shift handover authority

**Topics:**

**Entropy alerts: understanding and response**
- What is entropy? (In venue operator terms: "the content that was supposed to be playing doesn't quite match what is scheduled — something has drifted")
- How to read an entropy report: what was expected, what was found, how long, what impact
- When to acknowledge entropy as expected vs. when to escalate
- Adding notes to an entropy acknowledgment (important for pattern tracking)

**Advanced scheduling**
- How to read the full schedule view, including multi-day and recurring content
- Identifying schedule gaps (time slots with no content): what causes them, how to recognize them
- Using the schedule audit view: what played last Tuesday at 6pm and why?

**Screen introspection**
- Deep dive: selecting a specific screen and seeing what it is playing, why, and what comes next
- Using the audit timeline: scrolling through the day to see the content history for a single screen
- Identifying screens in fallback state: what it means, why it happens, what to do

**Shift handover mastery**
- Complex handover scenarios: active emergencies with unknown context, overrides set to expire during your shift, entropy alerts from the previous shift that were not acknowledged
- Incoming operator review: how to verify the handover report against the audit log
- When to reject a handover: if the report is incomplete, the incoming operator must not accept operational responsibility

**Certification gate:** No formal test — this is operational competency assessed by the REGIONAL_MANAGER based on performance review of the previous month's operational events. The REGIONAL_MANAGER confirms: does the operator correctly interpret entropy alerts? Do their handover reports accurately reflect shift state? Have they demonstrated emergency trigger/clearance correctly in a live situation?

---

## 2. REGIONAL_MANAGER Training Path

### Prerequisites

VENUE_OPERATOR Level 2 certification is required before regional manager training. Preferably Level 3, with demonstrated operational experience at the venue level. Regional managers who have not worked as venue operators will have significant gaps in understanding the operational reality they are responsible for escalating from and to.

### Advanced Multi-Venue Monitoring

**Topics:**
- The regional dashboard: how to read the per-venue health grid
- Aggregated entropy: what does a regional entropy pattern look like vs. an isolated venue issue?
- Active emergency tracking across the region: how to monitor multiple venues simultaneously
- When to act vs. when to delegate: the regional manager escalates from venue operators and escalates to enterprise admin — they are not the resolver of everything

**Escalation decision practice:**
Trainees work through 5 pre-configured scenarios:
1. One venue has CRITICAL entropy; the venue operator is asking what to do. What does the regional manager need to know to advise them?
2. Two venues in the same region have WARNING entropy that appeared in the same 30-minute window. Is this isolated or regional?
3. A venue operator cannot be reached and a HIGH alert has been active for 2 hours. What does the regional manager do?
4. A venue has had an emergency active for 45 minutes with no notes from the venue operator. What actions are available?
5. A canary promotion is awaiting regional manager approval. What information is reviewed before approving?

### Entropy Review and Escalation

**Topics:**
- Reading entropy reports at the regional level: venue comparison view, regional trend
- Acknowledging vs. escalating entropy: when is it a known content update vs. something to investigate?
- Entropy escalation to enterprise admin: what information to include when escalating

### Incident Response — Incident Commander Role

**Topics:**
- P2 incident (multi-venue impact): the regional manager as incident commander
- Information gathering: scope, severity, timeline — how to quickly establish the incident picture
- Communication: what to tell the enterprise admin, what to tell venue operators
- Decision-making under stress: the "safe action" principle (when uncertain, do the reversible thing first)

**Incident simulation:** Regional managers must complete one simulated P2 incident (multi-venue impact, unresolved after 10 minutes, escalation to enterprise admin required). The simulation uses the sandbox environment with pre-configured degraded state.

### Canary Awareness

**Topics:**
- What is the canary pathway and why does human approval exist?
- Reading the canary approval screen: parity ratio, CLASS_3/4 counts, stage duration
- The three decisions: approve, hold, rollback — what each means
- When the regional manager approves (SINGLE_VENUE stage) vs. when enterprise admin approves (later stages)

**Certification:** Assessed by ENTERPRISE_ADMIN based on operational review. Regional managers must demonstrate: they can correctly interpret a multi-venue entropy pattern, they can lead a simulated P2 incident to appropriate resolution, and they understand when to approve vs. hold canary promotion.

---

## 3. ENTERPRISE_ADMIN Training Path

### Prerequisites

Enterprise admins should have meaningful operational experience — ideally having served as a regional manager or in an equivalent oversight role. They must understand the operational reality of venue-level and regional-level operations before making fleet-level governance decisions.

Enterprise admins who lack venue and regional operational experience are likely to make governance decisions that are technically correct but operationally impractical.

### Constitutional Education

**What the enterprise admin must understand:**

**Why PRE exists and what it does:**
The legacy resolver has worked, but it is not constitutionally governed. PRE (Policy Resolution Engine) is a new resolution engine that applies the same rules in a governed, auditable, deterministic way. Before PRE can serve content authoritatively, it must earn parity with the legacy resolver through the canary process.

The enterprise admin must understand this not in technical terms but in governance terms: the canary process is how the platform certifies that the new system behaves identically to the system the venues depend on.

**What parity means in practical terms:**
Parity ratio is the fraction of resolutions where PRE and legacy produce identical results. 0.9999 means 1 in 10,000 resolutions differs. This sounds high, but at fleet scale across thousands of daily resolutions, it represents real differences. The CLASS_3/4 divergence counts are more important than the parity ratio — any semantic-level difference (CLASS_3) or constitutional integrity failure (CLASS_4) is a hard block on promotion.

**The human approval requirement:**
Human approval at every canary stage is not bureaucratic friction — it is a safety mechanism. The enterprise admin's approval is the system's guarantee that a human with full situational awareness authorized the promotion. An enterprise admin who approves without reviewing the data has converted a safety gate into a rubber stamp.

**Training exercise:** Enterprise admins complete a canary simulation exercise before receiving FLEET_WIDE approval authority. The simulation presents three scenarios:
1. A canary stage with excellent parity (0.99995), zero CLASS_3/4 divergences, and 3 days of stability. Should this be approved?
2. A canary stage with good parity (0.9997), zero CLASS_3/4 divergences, but only 4 hours of data. Should this be approved?
3. A canary stage with excellent parity (0.9999), one CLASS_3 divergence that has been reviewed and acknowledged as a known acceptable difference. Should this be approved?

The enterprise admin must reason through each scenario and document their decision. The simulation debrief reviews the governance rationale.

**Certification gate:** Enterprise admins receive FLEET_WIDE approval authority only after completing the canary simulation exercise and demonstrating they can correctly evaluate canary promotion scenarios. This gate is enforced in the system — the approval controls for FLEET_WIDE stage are not accessible to an enterprise admin who has not completed the simulation certification.

### Constitutional Events Response

**Topics:**
- CONSTITUTIONAL_RISK state: what to do as enterprise admin
- When to consult PLATFORM_ADMIN vs. act independently
- The rollback decision: when to roll back a canary stage rather than investigate in place
- Fleet-wide incident governance: the enterprise admin's role in a fleet-wide P1 incident

---

## 4. PLATFORM_ADMIN Training Path

### Who Needs This Training

Platform administrators have constitutional authority over the system. They can exit EMERGENCY_FREEZE, reset circuit breakers, and investigate constitutional integrity failures. This training is specialized and intensive — platform admins are expected to be technically expert.

### Full Constitutional System Training

**Topics:**

**State machine overview:**
The complete state machine: all 8 constitutional states, the allowed transitions, and what triggers each transition. Platform admins must be able to read the allowed-transitions table and trace any state transition from the events that caused it.

**Circuit breaker system:**
- PRECircuitBreaker: threshold=3, recovery_probe_ms=30000, CLOSED/OPEN/HALF_OPEN states
- EntropyCircuitBreaker: threshold=5, OPEN = advisory degraded
- ShadowCircuitBreaker: threshold=3, parity gap implications
- ReplayCircuitBreaker: threshold=1 (immediate), CLASS_4 and ConstitutionalBreachLog implications
- GlobalConstitutionalBreaker: NORMAL/READ_ONLY/EMERGENCY_FREEZE, reset requires human token

**Failure taxonomy:**
The 10 failure modes (FM-001 through FM-010) and their classification. Platform admins must be able to use CLASSIFICATION-RULES.md and FAILURE-TAXONOMY.md to classify an unknown incident during investigation.

**EMERGENCY_FREEZE exit procedure:**
This is trained through simulation. Platform admins must:
1. Enter the sandbox EMERGENCY_FREEZE state (triggered by the simulation coordinator)
2. Investigate the cause using the forensic audit view
3. Document what they found and what has been verified
4. Enter the authorization token
5. Complete the exit confirmation
6. Verify the system transitions to READ_ONLY (not directly to HEALTHY)
7. Initiate the READ_ONLY → HEALTHY recovery path

Platform admins must complete this simulation before receiving EMERGENCY_FREEZE exit authority. This is enforced in the system.

**Replay determinism investigation:**
ReplayCircuitBreaker threshold=1 means any detected nondeterminism triggers CLASS_4 immediately. Platform admins must understand: what replay nondeterminism means, how to reproduce it using the corpus replay harness, and how to determine whether it is a data anomaly or a systematic code-level issue.

**System integrity scripts:**
Platform admins must be familiar with the scripts in scripts/system-integrity/:
- full-stack-determinism.ts: verifying determinism across 100 runs
- cross-subsystem-consistency.ts: 30 consistency checks
- failure-mode-validation.ts: 62 failure mode validation checks

These scripts are the platform admin's diagnostic tools during constitutional events.

### Constitutional Responsibility Acknowledgment

Platform admins complete a written acknowledgment before receiving full constitutional authority. The acknowledgment covers:
- Understanding that EMERGENCY_FREEZE exit is a high-consequence action
- Understanding that circuit breaker reset without root cause identification may allow the failing condition to recur
- Commitment to documenting every constitutional intervention in the incident record
- Understanding of the escalation to the platform engineering team when root cause exceeds operational knowledge

---

## 5. Training Environment

### Sandbox Design

The training sandbox is a complete mirror of the production corpus (content library, schedules, campaigns) but with constitutional enforcement running in advisory mode — contract violations are logged but do not halt operations. This allows trainees to make mistakes, observe their consequences, and learn without causing production incidents.

**What the sandbox does:**
- All content management operations work normally
- PRE.resolve() runs with the production corpus
- Entropy, shadow comparisons, and parity reporting work
- EMERGENCY_FREEZE can be triggered and exited (with a trainer-issued human token for PLATFORM_ADMIN training)
- State transitions work correctly
- The audit log is fully populated from trainee actions

**What the sandbox does not do:**
- Does not propagate to real screens
- Does not create real audit records in the production log
- Does not send real alerts to production operators

Trainees should not be able to tell the difference between sandbox and production from the interface (beyond a clearly labeled "TRAINING ENVIRONMENT" banner). If the training environment behaves differently from production, trainees will develop incorrect mental models.

### Scenario Library

The training library includes pre-built scenarios representing common operational situations. Trainers can deploy these scenarios to a trainee's sandbox session.

**Core scenarios:**

| Scenario | Role | Type |
|---|---|---|
| S-01: Entropy alert on bar screens | VENUE_OPERATOR | Common alert response |
| S-02: Emergency trigger during event night | VENUE_OPERATOR | High-stakes action |
| S-03: Override expiry approaching at end of shift | VENUE_OPERATOR | Handover risk |
| S-04: Multi-venue entropy in same window | REGIONAL_MANAGER | Pattern recognition |
| S-05: P2 incident — 3 venues degraded simultaneously | REGIONAL_MANAGER | Incident command |
| S-06: Canary gate evaluation — approve or hold | ENTERPRISE_ADMIN | Governance decision |
| S-07: CONSTITUTIONAL_RISK state entered | ENTERPRISE_ADMIN | Constitutional response |
| S-08: EMERGENCY_FREEZE investigation and exit | PLATFORM_ADMIN | Constitutional authority |
| S-09: Replay nondeterminism detection | PLATFORM_ADMIN | Technical investigation |

### Preview-Heavy Training Philosophy

Every training path emphasizes the preview workflow before any publish action. Trainees preview before publishing in every scenario, even when the preview step is not strictly required for the training objective. This establishes the habit: preview is not optional; it is part of publishing.

Trainees who develop a habit of publishing without previewing are a production risk. The training environment enforces the preview step in scenarios by asking trainees to identify what the preview showed before they confirm their publish action.

---

## 6. Competency Gates

### What Competency Gates Are

Competency gates are system-enforced access controls tied to training certification. A VENUE_OPERATOR who has not completed Level 1 certification cannot log in with write access. A VENUE_OPERATOR who has not completed Level 2 cannot publish campaigns or create overrides. An ENTERPRISE_ADMIN who has not completed the canary simulation cannot approve FLEET_WIDE stage transitions.

These gates are not optional. Training certification must be recorded in the operator access system before the corresponding authority is granted.

### Gate Summary by Role

| Role | Gate | Authority Unlocked |
|---|---|---|
| VENUE_OPERATOR | Level 1 certification | Live system read access |
| VENUE_OPERATOR | Level 2 certification | Publishing authority (campaigns, overrides, emergencies) |
| REGIONAL_MANAGER | Regional training + L2 prerequisites | Regional monitoring, canary SINGLE_VENUE approval |
| ENTERPRISE_ADMIN | Canary simulation certification | FLEET_WIDE canary approval authority |
| PLATFORM_ADMIN | EMERGENCY_FREEZE exit simulation | EMERGENCY_FREEZE exit authority |

### The Knowledge Check

At any point during training or as a periodic recertification check, a trainer can ask a venue operator the following question:

> "The system health indicator shows DEGRADED. What does this mean, and what is the first thing you should do?"

If the operator cannot answer this correctly, they are not certified for live system access, regardless of whether they have completed the scheduled training hours.

The knowledge check is not about memory — it is about conceptual understanding. An operator who can answer this question about any constitutional state they might encounter during their shift has the operational literacy required for their role.

---

## 7. Recertification and Ongoing Competency

### Annual Recertification

Operators at all roles must complete annual recertification. This is not a repeat of initial training — it is a scenario-based review that covers:
- Any new features or changed workflows in the past year
- Review of any incidents in their venue/region that exposed operational knowledge gaps
- New scenarios added to the scenario library since their initial training

### Post-Incident Learning

After any P2 or P3 incident, the REGIONAL_MANAGER reviews the operational response and identifies any knowledge gaps that contributed to the incident. If a gap is identified, targeted re-training for the affected operators is scheduled within 30 days.

Post-incident learning is not punitive. The incident audit trail exists to improve the system and improve operator competency — not to assign blame. The framing must be "what did we learn" not "who made the mistake."

### New Feature Onboarding

When the system releases a significant new feature — a new constitutional state, a new canary stage, a change to the alert taxonomy — operators at affected roles receive targeted training before the feature is activated in production. Training for new features follows the same scenario-based approach as initial training.
