# ClubHub TV — Design Principles for Operations
# Shared Operational Intelligence Layer

**Document type:** Living foundational reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22
**Status:** FOUNDATIONAL — this document governs all future UX, workflow, dashboard, and operational surface design

---

## Purpose

This document establishes the foundational design principles that govern all operator-facing surfaces in ClubHub TV: the CMS, the preview system, monitoring dashboards, alert surfaces, onboarding flows, and operator tooling.

These principles are NOT generic UX best practices. They are derived from:
- The Engineering Constitution and its philosophical axioms
- The operator mental model analysis in OPERATOR-MENTAL-MODELS.md
- The entropy patterns documented in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
- The failure stories in FAILURE-STORIES.md
- The playout pattern library in PLAYOUT-PATTERN-LIBRARY.md

**These principles exist to close the gap between operator mental models and system reality.** Every design decision that widens this gap — even if it reduces short-term friction — violates the intent of this document.

---

## Governing Philosophy

**2.1 Determinism outranks convenience.** (Engineering Constitution §2.1)
Design that makes operators feel the system is predictable outranks design that is fast but produces surprising outcomes.

**2.2 Explainability outranks optimization.** (Engineering Constitution §2.2)
Every operator surface that shows a result must provide a path to understanding why that result occurred.

**2.3 Visibility outranks automation.** (Engineering Constitution §2.3)
Surface problems. Don't silently fix them. A design that hides complexity by silently correcting operator mistakes destroys accountability.

**2.7 Human operators are authoritative over intent.** (Engineering Constitution §2.7)
No design feature may infer, assume, or correct operator intent. The system observes; operators decide.

---

## Section 1 — Resolution Transparency Principles

### P-RT-01: The Resolution Truth Principle

**Statement:** Every screen in every screen list, area view, and campaign view must be showing its current PRE resolution state — not its scheduled state. Showing "scheduled" state without resolution state is presenting a fiction.

**Rationale:** The single largest source of operator confusion is the gap between "what I configured" and "what is resolving." CMS surfaces that show only configuration state reinforce the incorrect mental model that "scheduled = playing." Resolution state must be first-class information everywhere operators make decisions.

**Implementation requirement:** Every screen list item must have an immediately visible resolution indicator showing: current resolution level (LEVEL_0–6), whether it is receiving the area campaign (or is under override), and confidence signal.

**Anti-pattern:** Showing "Campaign: Summer Drinks 🟢 Active" without showing that 5 of 8 screens in the area are not receiving that campaign due to overrides. This is factually accurate (the campaign is active) and operationally misleading.

---

### P-RT-02: The Override Visibility Principle

**Statement:** Any screen under an active operational override must be visually distinguished from screens resolving through standard campaign scheduling, in every context where that screen appears.

**Rationale:** Override divergence (M-01) is the most common entropy pattern. It propagates because overrides are invisible in most CMS views — they exist in a separate section that operators don't consult when reviewing campaigns. Making override status permanently visible at the screen level prevents the "I published a campaign and it isn't reaching these screens" confusion.

**Implementation requirement:** In area views, campaign coverage maps, and screen lists — screens under operational override must show a distinct visual state (different icon, color treatment, or badge) that communicates "this screen is not following area scheduling" without requiring the operator to navigate away.

**Do not implement:** Color coding alone (colorblind accessibility issue). Icon + text combination required.

---

### P-RT-03: The Coverage Gap Principle

**Statement:** When an operator performs an action intended to affect multiple screens (publish a campaign, create an area override, activate an emergency), the system MUST show how many screens the action will actually affect vs. how many are in scope — before the action is confirmed.

**Rationale:** Operators assume "targeting Bar Area" means "all screens in Bar Area." The coverage gap (screens under higher-priority rules that won't receive the action) is invisible without this principle. Pre-action coverage disclosure closes the mental model gap without blocking the action.

**Implementation requirement:** Campaign publish confirmation: "Publishing this campaign will reach 12 of 15 screens in Bar Area. 3 screens are under active overrides and will not receive this campaign. [View affected screens]" — with the ability to proceed or investigate before proceeding.

**Do not implement:** Blocking the action (Engineering Constitution §2.3 — visibility, not enforcement). Do not silently proceed either. Pre-action disclosure is required.

---

### P-RT-04: The Resolution Explainability Principle

**Statement:** For any screen, at any time, an operator must be able to find out: what is currently resolving, which rule caused it to resolve, and what prevented other rules from resolving.

**Rationale:** Engineering Constitution §2.2 and the operator's contractual right to explain screen state ("An operator MUST always be able to answer: why is that screen showing that content right now?").

**Implementation requirement:** Per-screen detail view must include a "Resolution Explorer" that surfaces the reason_trace in operator-readable language: "Showing: Summer Drinks Campaign / Why: Area schedule, Bar Area, active since Tuesday / Why not X: Overridden by Beer Brand Lock-in (created May 3, no expiry)"

**Key design challenge:** Translating reason_trace JSON into natural language without losing constitutional precision. The reason trace must be accurate — do not simplify to the point of inaccuracy.

---

## Section 2 — Override Management Principles

### P-OM-01: The Expiry Default Principle

**Statement:** When an operator creates an operational override, the expiry field must be the first, most prominent configuration field — not an optional, secondary, or hidden field. A permanent override must require explicit confirmation, not just silence.

**Rationale:** The overwhelming majority of override accumulation begins with overrides created without expiry dates, under time pressure, with the intention of later review that never happens. Urgency-permanence conflation (OPERATIONAL-ENTROPY §3.5) is the root cause. The system cannot eliminate this behavior but can create friction at the exact moment of origin.

**Implementation requirement:** Override creation UI must present "How long should this last?" as a required first field with suggested durations (End of today / End of this week / Custom date / Until manually removed). "Until manually removed" must be explicitly labeled — not presented as a blank field that defaults to permanent.

**Do not implement:** Blocking permanent overrides. Making "Until manually removed" harder to select than a duration option. These would violate operator agency.

---

### P-OM-02: The Override Age Surfacing Principle

**Statement:** Active overrides must display their age and original context (creator, creation reason if provided) in every view where they appear. An override that is "30 days old, created by [former employee]" must be visually distinguishable from an override that is "1 hour old, created by [current manager]."

**Rationale:** Override accumulation persists because the cost of deletion is perceived as higher than the risk of keeping it. Deletion requires understanding intent; understanding intent requires knowledge that is lost when the creating operator leaves. Override age and provenance surfacing reduces the perceived cost of deletion by providing the context needed to make a decision.

**Implementation requirement:** Override detail view (and wherever overrides appear in lists): created by, created at, age in human-readable format ("47 days ago"), reason/note field (if populated), expiry status ("permanent" or time to expiry).

---

### P-OM-03: The Override Audit Trail Principle

**Statement:** Every override modification (create, extend, shorten, deactivate, delete) must create an immutable audit event with: who, what, when, why (optional but prominently prompted). This audit trail must be visible from the screen view, not just in a separate audit log.

**Rationale:** The "why is this override here?" question is the most common blocked decision in override management. If the audit trail is only in a separate log, operators don't find it. Inline display of the override's history at the screen level makes this information accessible in the decision context.

---

## Section 3 — Entropy Visibility Principles

### P-EV-01: The Entropy Score Contextual Display Principle

**Statement:** The venue entropy score must appear in the primary CMS navigation, not buried in a separate analytics or health section. Entropy score should be visible before operators enter any configuration workflow.

**Rationale:** Entropy is invisible until it surfaces as confusion or a complaint. Displaying the entropy score as a routine part of the CMS navigation creates a habit of awareness before operators make configuration decisions.

**Implementation requirement:** Venue-level navigation must include an entropy health indicator (color-coded, with score) that operators see every time they access the CMS. Click → opens the entropy detail view with M-01 through M-12 breakdown.

**Tone requirement:** Entropy surfacing must feel like a dashboard instrument, not an alarm. A score of 65 is not "bad" — it is "worth reviewing." Language must reflect advisory status. The operator decides whether to act.

---

### P-EV-02: The Drift Signal Persistence Prevention Principle

**Statement:** Entropy advisories that have been continuously active for more than 30 days must escalate their visual treatment. Warnings that persist without acknowledgment or resolution must not fade into background noise.

**Rationale:** The Sponsor Saturation story (Failure Story 5) illustrates how a correct, persistent advisory loses signal value when it becomes ambient noise. A 14-month SOV warning that has never been acted on is no longer communicating anything. Escalating visual treatment over time (color intensity, prominence, position in view) prevents desensitization.

**Implementation requirement:** Advisory severity levels: ADVISORY (days 1–14, standard treatment) → ADVISORY-PERSISTENT (days 15–30, slightly elevated treatment) → REVIEW (30+ days, clearly elevated treatment with "This advisory has been active for X days" text). Operators must be able to acknowledge-and-snooze with a reason, which resets the escalation but creates an audit record.

---

### P-EV-03: The Prospective Impact Principle

**Statement:** When an operator action will worsen an existing entropy signal, the system must surface the prospective impact BEFORE the action is confirmed — not after.

**Rationale:** Retrospective entropy signals (M-01 through M-12) tell operators about the current state. But the most valuable intervention point is at the moment of a decision that would worsen the state. "You're about to add a sponsor contract that will bring total SOV to 110% — at this level, editorial content will receive approximately 0% of screen time" is actionable in a way that "SOV is now 110%" is not.

**Implementation requirement:**
- Adding a sponsor contract: Show projected combined SOV and projected editorial content percentage.
- Creating an override without expiry: Show "This screen currently has X active permanent overrides. This will become the X+1st."
- Creating a schedule at priority > (max - 20): Show current priority range width and advisory.

**Boundary condition:** Prospective impact must not block actions (Engineering Constitution §2.3). It must inform, not gate.

---

### P-EV-04: The Comparative Floor Principle

**Statement:** When surfacing an entropy metric for a venue or area, always show a comparison baseline. Not just "Override Divergence Rate: 34%" but "Override Divergence Rate: 34% (advisory threshold: 15%, review threshold: 30%)."

**Rationale:** Raw percentages are meaningless without context. Operators need to understand whether 34% is concerning, catastrophic, or normal. Constitutional thresholds provide the comparison frame.

---

## Section 4 — Preview System Principles

### P-PS-01: The Preview-First Principle

**Statement:** The preview system is not a feature — it is the primary mechanism for closing the operator mental model gap between "what I configured" and "what is resolving." It must be available from every configuration surface that affects playout.

**Rationale:** Every failure story in FAILURE-STORIES.md either involves a missing preview ("The Campaign That Wasn't Showing," "The Preview That Lied") or would have been prevented by a preview that was accessible in context. Preview is the highest-leverage operator tool for entropy reduction.

**Implementation requirement:** Preview access from: campaign publish confirmation, schedule creation, override creation, area view, screen list, individual screen detail. One click from any configuration action to "preview what this screen will show after this change."

**Do not implement:** Preview as a separate section requiring navigation away from the configuration workflow. Context preservation is essential.

---

### P-PS-02: The Preview Accuracy Principle

**Statement:** The preview must show exactly what the PRE will resolve, using the real PRE function on real system state, not a simulation or approximation. Inaccurate preview is worse than no preview.

**Rationale:** If operators learn that "the preview showed X but the screen showed Y," they will stop trusting the preview. A preview that builds operator trust in the system's determinism is operationally valuable. A preview that erodes trust is actively damaging.

**Implementation requirement:** Preview endpoint must call the actual PRE function on the actual current database state. No client-side simulation. No "estimated" resolution. The preview IS the resolution — called with a specific (screen_id, t) pair. The OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §9 PRE Preview Endpoint specification governs this.

---

### P-PS-03: The Multi-Screen Preview Principle

**Statement:** Operators must be able to preview resolution for all screens in a targeted area simultaneously, not just one screen at a time.

**Rationale:** The "Preview That Lied" failure (Failure Story 7) occurred because the operator checked one screen (correct resolution) and concluded all screens were correct. A coverage map showing the resolution state of all 8 bar screens simultaneously — visually, at a glance — would have revealed the 5 with overrides immediately.

**Implementation requirement:** Area view includes a "coverage snapshot" showing each screen's current resolution, grouped by: "Receiving area campaign / Under operational override / Under scheduled override / In emergency / Showing fallback." This is computed from the PRE on demand for all screens in the area.

---

### P-PS-04: The Temporal Preview Principle

**Statement:** Operators must be able to preview what a screen will show at a future time, not just at the current moment.

**Rationale:** Daypart scheduling, time-windowed campaigns, and expiring overrides all produce future-dated state changes. An operator who publishes a "lunch specials" campaign wants to verify it will activate at 11:00am — before 11:00am. Temporal preview closes this gap.

**Implementation requirement:** Preview UI includes a time picker ("Preview as of: [datetime] [venue timezone]"). The PRE is called with the selected timestamp rather than the current timestamp. Results show resolution at that future time.

**Constitutional note:** The PRE accepts `t` as a parameter — this is constitutionally straightforward to implement.

---

## Section 5 — Emergency and Override Urgency Principles

### P-EU-01: The Emergency Friction Principle

**Statement:** Emergency activation must require a reason field. The UI must surface the venue's recent emergency activation count before confirming activation. Non-emergency alternatives must be offered and accessible from the emergency activation flow.

**Rationale:** Emergency Semantic Collapse (Failure Story 2) is entirely preventable through design friction. The key intervention points are: (1) reason field requirement creates a paper trail that exposes misuse; (2) usage count surfacing creates self-awareness in the moment; (3) alternatives offered means operators who want "fast override" have an accessible alternative that doesn't destroy the emergency audit trail.

**Implementation requirement:**
1. Reason field: Required, minimum 10 characters, labeled "Why is this an emergency?" — not "Notes" or "Description."
2. Usage count: "This venue has activated emergency [N] times in the past 30 days."
3. Alternative offer: "If this is not a safety emergency, consider Operational Override instead. [Create Override]" — accessible without leaving the flow.
4. Emergency activation is NOT blocked by any of the above. These are friction points, not gates.

---

### P-EU-02: The Urgency-Appropriate Workflow Principle

**Statement:** The CMS must provide a direct path for high-urgency content changes that does not require full campaign creation workflow, while still producing auditable, time-bounded records.

**Rationale:** Operators under time pressure (shift managers during events, venue managers during incidents) cannot and will not complete multi-step campaign creation workflows. Providing no fast path forces them to use overrides (entropy) or emergencies (semantic collapse). A well-designed "quick update" workflow that is fast, simple, and produces bounded records is the correct design response.

**Implementation requirement:** "Quick change" or "Operational change" workflow:
1. Select screen(s) or area.
2. Select content or upload content.
3. Select duration: "For how long? [1 hour / Tonight / Until I end it / Custom]"
4. One-tap confirm.
This creates a time-bounded LEVEL_1 override with the specified expiry. Fast, auditable, bounded.

**This is distinct from:** Full campaign creation (for planned promotional content), schedule management (for recurring content), emergency activation (for genuine safety incidents).

---

## Section 6 — Information Architecture Principles

### P-IA-01: The Configuration-vs-Resolution Separation Principle

**Statement:** The CMS must maintain a clear visual and architectural distinction between "configuration state" (what you've set up) and "resolution state" (what the system is actually doing). These are different things and must be presented as different things.

**Rationale:** The entire "Published = Playing" mental model failure (documented in OPERATOR-MENTAL-MODELS.md) stems from CMS designs that conflate configuration and resolution. When the campaign list shows "Active" for a campaign that is not reaching 40% of targeted screens, it is presenting the configuration state as if it were the resolution state.

**Implementation requirement:**
- Configuration views (Campaigns, Schedules, Overrides): Show the configuration state — what has been set up, lifecycle status, time windows.
- Resolution views (Screen List, Area Coverage, Preview): Show the resolution state — what the PRE is actually producing for each screen.
- Navigation and language must make the distinction clear: "Campaign Management" vs "What's Playing Now."

---

### P-IA-02: The Role-Appropriate Depth Principle

**Statement:** The primary operator workflow must match the typical operator role's needs and competency. Advanced configuration options must be discoverable but not dominant.

**Rationale:** Venue managers and shift managers — the primary operators — need: create a quick change, see what's playing, check if a specific screen is correct. They do NOT need: full campaign lifecycle management, entropy metrics, or resolution trace on every screen in every view. Showing too much complexity to primary operators creates decision fatigue and drives them toward the fastest available shortcut (override and forget).

**Implementation requirement:** Primary view design for each role:
- Shift manager: "What's playing right now" + "Make a quick change." Everything else is secondary or hidden.
- Venue manager: Campaign management + "What's playing in each area" + entropy indicators.
- Org admin: Cross-venue health overview + user management + sponsorship contracts + org-level campaigns.

**Anti-pattern:** Presenting the same CMS interface to all roles. Role-appropriate depth reduces cognitive load for primary operators and surfaces appropriate tools for each context.

---

### P-IA-03: The Audit Trail Visibility Principle

**Statement:** The audit trail for any configuration record must be accessible from the record itself — not in a separate audit log that requires separate navigation.

**Rationale:** The most common "why does this screen show X?" investigation requires: (1) finding the active rule, and (2) understanding its history. If the history is only in a separate audit log, step 2 requires knowing the record ID, navigating to the audit log, and filtering. Most operators cannot and will not do this. Inline audit history makes rule provenance accessible in the decision context.

**Implementation requirement:** Every configuration record (schedule, override, campaign, sponsorship contract, emergency state) must have an expandable "History" section showing all mutations to that record in reverse chronological order: [timestamp] [operator] [action] [field changed] [old value → new value] [reason if provided].

---

## Section 7 — Confirmation and Consequence Principles

### P-CC-01: The Consequence-Before-Confirmation Principle

**Statement:** The confirmation dialog for any significant action must surface the consequences of that action — specifically what will change and who will be affected — before asking for confirmation.

**Rationale:** "Are you sure?" dialogs are the lowest-information confirmation mechanism. They confirm intent but not consequence. "Publishing this campaign will reach 12 of 15 screens. 3 screens are under override. The following content will be replaced: [list]. Is this correct?" is a consequence-first confirmation.

**Action categories requiring consequence surfacing:**
- Campaign publish → coverage gap disclosure
- Override creation → screens affected + expiry status
- Emergency activation → scope + usage count + alternatives offered
- Content deletion → schedules that reference this content (will fall to fallback)
- Campaign archival → residual schedule rows that may remain active

---

### P-CC-02: The Proportional Friction Principle

**Statement:** The friction presented to an operator before an action must be proportional to the reversibility and blast radius of that action.

**Rationale:** Uniform high friction on all actions produces alert fatigue — operators learn to dismiss confirmation dialogs automatically. Uniform low friction on all actions produces reckless configuration changes. Proportional friction calibrates the operator's attention to the actual risk.

**Friction scale:**
- Low risk (create a draft campaign): No friction. Just confirm.
- Medium risk (create an override with no expiry): One-step friction — "This is permanent. Set an expiry if this is temporary."
- High risk (publish a campaign with coverage gaps): Two-step friction — show gaps, then confirm.
- Very high risk (org-level emergency activation): Three-step friction — reason required, usage count shown, alternatives offered, explicit confirmation.
- Catastrophic risk (delete all schedules for a venue): Typed confirmation of venue name required.

---

## Section 8 — Error and Advisory Communication Principles

### P-EA-01: The Advisory Tone Principle

**Statement:** Entropy advisories must be communicated in a tone that is informational, not accusatory. They must describe the system state, not judge the operator.

**Rationale:** Operators who feel judged by advisory signals develop adversarial relationships with the advisory system. They dismiss warnings, learn to avoid triggering them, or ignore the CMS sections where they appear. Advisory signals are only useful if operators engage with them.

**Language pattern:**
- ✓ "34% of screens in Bar Area are showing content from operational overrides rather than the area campaign."
- ✗ "Warning: Too many overrides on Bar Area screens."
- ✓ "This venue has not had content updates in 47 days. Consider reviewing for accuracy."
- ✗ "Content is outdated. Update required."

---

### P-EA-02: The Actionable Advisory Principle

**Statement:** Every advisory must include a direct path to the action that would resolve the advisory condition. An advisory with no clear resolution path is noise.

**Rationale:** An operator who reads "34% of Bar Area screens are showing override content" and cannot immediately find the path to review those overrides will close the advisory and continue working. The advisory has communicated a fact but provided no leverage.

**Implementation requirement:** Every advisory includes: description of condition, specific data (which screens, what metric value, what threshold), and at least one direct action link ("Review overrides for Bar Area"). The action link should navigate to a filtered view that surfaces exactly the relevant records — not to a general overrides list.

---

### P-EA-03: The Silent System Principle

**Statement:** The CMS must generate no alerts or advisories unless there is a specific, actionable, operator-relevant condition to surface. Empty states, successful operations, and normal operations must be visually quiet.

**Rationale:** Alert fatigue is the primary risk to advisory system effectiveness. Every unnecessary alert is a withdrawal from the operator's attention budget. The advisory system works only if operators trust that signals are meaningful. Over-alerting destroys that trust.

**Implementation requirement:** A venue with an entropy score of 95 (healthy), no overrides, recent content updates, and all screens delivering correctly should display no advisory signals. No "all good" messages needed — silence is the signal of health.

---

## Section 9 — Onboarding and Training Principles

### P-OT-01: The Mental Model Correction Priority Principle

**Statement:** Onboarding must explicitly address the dangerous mental models identified in OPERATOR-MENTAL-MODELS.md, not just describe system features. The most important training outcome is correct mental models, not feature knowledge.

**Dangerous mental models to address in onboarding (by role):**

**All roles:**
- "Published = Playing" (most critical)
- "15-second poll cycle" (set expectations)
- "The screen list shows what's resolving, not just what's configured"

**Venue managers:**
- "Overrides supersede campaigns — a campaign reaching 12 of 15 screens is telling you 3 screens have overrides"
- "Priority is a tiebreaker within Level 3 — it cannot override Level 1"

**Shift managers:**
- "Overrides persist past your shift unless you set an expiry"
- "Emergency is for genuine safety incidents; for quick changes, use operational override"

---

### P-OT-02: The Show-Don't-Tell Principle

**Statement:** Onboarding for resolution model understanding must use the actual preview system on real screens, not diagrams or text descriptions. Operators understand resolution best when they can observe it directly.

**Rationale:** The resolution model is counterintuitive for operators who expect "configured = playing." Text descriptions of the model do not displace the intuitive model. Operators need to see the model in action: "I have a schedule here, but the screen is showing THIS because of THAT override. Watch when I deactivate the override — the schedule takes effect."

**Practical implication:** The preview system must be available during onboarding, even for new deployments with minimal real configuration. A training sandbox environment with example configurations may be needed.

---

## Section 10 — Constitutional Compliance Checklist for UX Design

Before finalizing any UX design for an operator-facing surface, verify:

| Check | Principle | Pass criteria |
|-------|-----------|---------------|
| Does this surface show resolution state or configuration state? | P-RT-01 | Resolution state is clearly surfaced; configuration state is labeled as such |
| Are screens under override visually distinct? | P-RT-02 | Yes, with accessible visual treatment |
| Does a coverage-affecting action show impact before confirmation? | P-RT-03 | Yes — show affected vs in-scope count |
| Is there a path to explain why any screen shows what it shows? | P-RT-04 | Yes — resolution explorer accessible from screen detail |
| Does override creation make expiry prominent? | P-OM-01 | Yes — first, required field |
| Does this surface violate operator agency by blocking or correcting? | Engineering Constitution §2.7 | No — surface informs, operator decides |
| Is the advisory tone informational rather than accusatory? | P-EA-01 | Yes |
| Does each advisory include an actionable path? | P-EA-02 | Yes |
| Does a pre-action consequence surface exist for high-risk actions? | P-CC-01 | Yes |
| Is the friction proportional to the action's blast radius? | P-CC-02 | Yes |

---

*End of DESIGN-PRINCIPLES-FOR-OPERATIONS.md v1.0*
*This document governs all future operator-facing design. Amendments require explicit documentation of the engineering constitution basis for the change.*
*New principles may be appended with evidence from operational experience or new mental model research.*
