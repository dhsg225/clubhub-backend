# ClubHub TV — Template and Preset Governance
# Shared Operational Intelligence Layer

**Document type:** UX governance — template safety and reuse architecture
**Authority:** Agent 3 (UX Architecture / Operator Experience) with Agent 2 review for policy
**Audience:** UX contributors, operational system designers, template authors, onboarding teams
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all template creation, distribution, and lifecycle design

---

## Purpose

This document defines how templates and presets — reusable operational configurations — are governed to prevent them from becoming vectors of operational entropy, inherited bad assumptions, and invisible semantic drift.

The threat this document addresses: operational cargo cults. A template created to solve a specific problem at one venue, at one time, under specific conditions, is adopted by ten other venues as "best practice." The original context is forgotten. The assumptions encoded in the template are inherited without examination. When conditions change, the template continues to be applied because it always has been — until it fails in a way that no one understands because no one knew what the template was actually doing.

**The governing principle: templates are operational policy, not operational shortcuts.** Using a template is not pressing a "convenient button" — it is adopting an operational stance. Template users must understand what they are adopting, and template authors must make that understanding possible.

---

## Section 1 — Template Philosophy

### 1.1 Templates as Operational Policy

A scheduling template defines which content runs when, under what override conditions, with what sponsor priority — a complete operational stance for a class of operational moments. An emergency preset defines what content activates, at what scope, with what justification, in the highest-stakes operational scenario the platform handles.

These are not neutral configuration shortcuts. They are operational policies encoded in a reusable form. The operator who applies a template is enacting the policy its author designed. The author's assumptions, constraints, and contextual knowledge are embedded in the template — whether or not they are documented.

**Template governance principle:** Every template must be understood by anyone who uses it. If understanding a template requires the author to explain it verbally, the template has a documentation failure, not a user competence failure.

### 1.2 Repeatability vs Rigidity

Templates support repeatability — the ability to apply consistent operational configurations across venues and over time without reconstructing them from scratch. This is valuable. But templates can also create rigidity — situations where a configuration pattern is applied because it's the template, not because it's appropriate, and where deviation requires more effort than compliance even when compliance is wrong.

**Healthy repeatability:** The template captures what worked. Using it saves time. Operators understand what it does and can modify it when the situation differs.

**Unhealthy rigidity:** The template captures what someone once did. Using it is the path of least resistance. Operators don't know what it does and don't modify it because modification feels risky.

The governance design must support healthy repeatability while preventing unhealthy rigidity.

### 1.3 Governance-Aware Reuse

Not all templates can be safely reused in all contexts. A template built for a nightclub's event-night operations may encode assumptions — ambient noise level, operator attention level, customer behavior, sponsor priority weighting — that are invalid in a hotel lobby context. Reusing the template in the hotel context may produce technically valid but operationally incorrect behavior.

**Governance-aware reuse requires:**
- Templates document the context for which they were designed
- The platform warns when a template is being applied in a context that differs materially from the design context
- Operators can preview what the template will produce in the current context before applying it

### 1.4 Anti-Fragile Standardization

Anti-fragile standardization is the design of templates that improve under use rather than degrading. Templates should evolve as operational understanding matures — bad assumptions are discovered and corrected, new conditions are documented, edge cases are addressed.

The failure mode is templates that are treated as immutable artifacts — never updated because "changing the template is risky" and because no one wants to take responsibility for a change that might break something. This produces increasingly stale templates that encode outdated assumptions applied to current operations.

**Anti-fragile design:** Templates have a formal review cycle. Templates that have not been reviewed within a defined period surface as "pending review" rather than remaining available as authoritative presets. Template updates are tracked with version history and review notes.

---

## Section 2 — Template Types and Governance Rules

### Type T-01: Scheduling Templates

**What they are:** Predefined schedule structures — content windows, block sequences, rotation patterns — that can be applied to a venue's scheduling configuration.

**Risk profile:** Medium. Scheduling templates may encode assumptions about content availability, override priorities, and sponsor window allocations that are time-sensitive and venue-specific.

**Governance requirements:**
- Documentation: what scheduling pattern does this template create? For what operational context?
- Context specificity: which venue types and operational contexts is this template validated for?
- PRE preview: applying a scheduling template must trigger a PRE preview of the resulting effective state for the next 24-hour window before the template is committed
- Conflict detection: applying a scheduling template must check for conflicts with existing active overrides and alert to any conflicts before commitment
- Review cycle: 90 days (schedules change with seasons and content availability)

---

### Type T-02: Sponsorship Templates

**What they are:** Predefined sponsorship configurations — SOV targets, rotation priorities, content window allocations for sponsor campaigns.

**Risk profile:** High. Sponsorship templates encode contractual commitments. Applying a template with incorrect SOV targets or incorrect sponsor priority can produce contract compliance failures.

**Governance requirements:**
- Documentation: which sponsor contract does this template serve? What SOV target does it encode?
- Contract reference: the template must be linked to the active contract it implements. A template without a live contract reference is classified as "unlinked" and surfaces a warning on application.
- PRE preview: SOV projection for the next contract period must be generated before commitment
- Sponsor team review: Tier 1 and Tier 2 sponsor templates (high-value contracts) require explicit sponsorship team sign-off before they can be applied at new venues
- Review cycle: at contract renewal, or at any SOV reconfiguration

---

### Type T-03: Emergency Presets

**What they are:** Predefined emergency configurations — content, scope, activation conditions — that can be applied rapidly during LEVEL_0 emergency events.

**Risk profile:** Critical. Emergency presets are applied under maximum stress with minimal cognitive bandwidth. An incorrect emergency preset applied at maximum urgency can produce fleet-wide content failure.

**Governance requirements:**
- Documentation: what emergency scenario is this preset designed for? What content does it activate? What is the expected scope?
- Regular testing: emergency presets must be tested in a preview/simulation environment on a defined schedule. Untested presets older than 90 days surface as "unvalidated."
- Scope documentation: the preset's default scope must be explicitly stated and must follow the minimum-scope principle (narrowest appropriate scope as default)
- Content validation: the content referenced by the preset must be confirmed available before the preset is stored as active
- Review cycle: 90 days, or after any emergency that used the preset

---

### Type T-04: Venue Onboarding Presets

**What they are:** Standard configurations applied when a new venue joins the fleet — default dashboard layouts, notification pacing, initial schedule structures, default override expiry windows.

**Risk profile:** Medium-high. Onboarding presets set the initial operational baseline for a new venue. Bad assumptions in onboarding presets propagate to every new venue.

**Governance requirements:**
- Documentation: what operational baseline does this preset establish? For what venue type?
- Version clarity: the onboarding preset version in use must be visible, so venues onboarded on old presets can be identified and reviewed
- Post-onboarding review: a 30-day post-onboarding review should evaluate whether the applied preset is appropriate for the specific venue's actual operational context
- Review cycle: 60 days, or after any issue traced back to onboarding configuration

---

### Type T-05: Event-Night Presets

**What they are:** Operational configurations for specific event types — sports events, live music, corporate functions, seasonal events.

**Risk profile:** Medium. Event presets may be created for a specific past event and incorrectly generalized to future events.

**Governance requirements:**
- Documentation: what specific event type is this preset for? What operational conditions does it assume?
- Event type binding: the preset should be tagged with the event types it is validated for. Applying it to a different event type surfaces a warning.
- Historical replay link: where the preset was used previously, a replay link to a past successful application should be attached as validation evidence
- Review cycle: annually, or after a significant event that used the preset

---

### Type T-06: Dashboard Layout Templates

**What they are:** Predefined operational workspace layouts — which panels are visible, what information density, what priority arrangement.

**Risk profile:** Low. Layout templates primarily affect operator experience, not operational semantics. However, layouts that hide critical information or violate the visual priority hierarchy (INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md Section 4) are operationally dangerous.

**Governance requirements:**
- Constitutional compliance: every layout template must be verified against the visual priority hierarchy. Templates that demote effective state or Tier 3+ signal visibility below canonical placement are non-compliant.
- Role appropriateness: layout templates should be tagged for the operator role they are designed for
- Review cycle: 180 days

---

### Type T-07: Escalation Presets

**What they are:** Predefined escalation configurations — who gets notified, in what order, through what channels, at what tier threshold.

**Risk profile:** High. Escalation presets determine who knows about operational problems. An incorrect escalation preset may route critical incidents to the wrong people or at the wrong tier.

**Governance requirements:**
- Contact verification: escalation preset contact lists must be verified as current. Contacts who are no longer in the relevant role trigger a "stale contact" warning.
- Tier alignment: escalation tiers in the preset must align with the platform's signal tier definitions. A preset that escalates Tier 2 conditions to Tier 4 response is incorrectly calibrated.
- Review cycle: 30 days (personnel changes frequently)

---

## Section 3 — Template Lineage and Provenance

### 3.1 Template Ancestry Visibility

Every template should be traceable to its origin. A template derived from another template inherits the parent's lineage. A template created from scratch has an origin story that explains why it was created.

**Ancestry record:**
- Origin: created from scratch / derived from [parent template] / imported from [source]
- Author: who created it, at what time, for what purpose
- Validation: what evidence exists that this template produces correct operational results
- Deployment history: where has this template been applied and with what outcomes

### 3.2 Derivation Tracking

When an operator modifies a template to create a venue-specific version, the derived template should maintain its relationship to the parent. The operator should be able to see, for any derived template, what was changed from the parent and why.

**Derivation display:** A "differs from parent" indicator that shows which configuration fields have been modified, when each modification was made, and what the current parent value is for each modified field. This allows operators to evaluate: "The parent template has been updated since I derived my version — does the change apply to my version too?"

### 3.3 Modification Lineage

Every modification to a template should be tracked:
- What changed
- Who changed it
- When
- Why (required annotation)
- What was the operational context that prompted the change

Modification lineage is the primary tool for debugging template-related operational failures. "When did this template start producing unexpected results, and what changed around that time?" is answerable only if modification history is complete.

### 3.4 Regional Divergence Tracking

When a base template is deployed across multiple venues in a region, and individual venues have derived local versions, the divergence between local versions and the regional base should be tracked and periodically reviewed.

**Regional divergence audit:**
- For each venue's derived template: what percentage of fields differ from the regional base?
- How long has the divergence existed?
- Has the divergence been reviewed and intentionally maintained, or is it inherited without examination?
- Are multiple venues showing the same divergence pattern? (Signals a potential improvement to the regional base)

---

## Section 4 — Template Risk Model

### 4.1 High-Blast-Radius Templates

A template's blast radius is the maximum scope of operational impact if the template contains an error. An emergency preset that activates fleet-wide content has a fleet-wide blast radius. A single-screen scheduling template has a single-screen blast radius.

**Blast radius classification:**
- **Contained** (single screen or small screen group): standard review process
- **Venue-wide** (all screens at one venue): elevated review — PRE preview required for full venue
- **Multi-venue** (regional or fleet-wide templates): highest review tier — requires sponsorship team review if SOV implications, requires NOC review if fleet impact

Templates with venue-wide or multi-venue blast radius require explicit operator acknowledgment of the blast radius before application: "This template affects all [N] screens at [venue / fleet]. Confirm to proceed."

### 4.2 Unstable Inherited Assumptions

A template assumption is unstable when the condition it assumes may change independently of the template. The template encodes "sponsor X has priority during evening windows" — but the sponsor contract has since changed. The template now applies outdated policy.

**Assumption stability classification:**
- **Stable assumptions:** operational patterns that are unlikely to change (timezone, venue type, general schedule structure)
- **Conditional assumptions:** assumptions that depend on external conditions that may change (contract terms, content availability, seasonal programming)
- **Volatile assumptions:** assumptions that frequently change (event schedules, promotional priorities, staff availability)

Templates with conditional or volatile assumptions require more frequent review cycles and should display the stability classification to operators considering applying them.

### 4.3 Stale Template Detection

A template is stale when:
- It has not been reviewed within its review cycle
- It references content that is no longer available
- It references contacts who are no longer in the relevant role
- It encodes assumptions that have been superseded by platform updates
- It has been applied more than N times without a review

**Stale template display:** Templates that have reached their review deadline surface as "review recommended" — not blocked, but requiring the operator to acknowledge the staleness before applying. Templates that are significantly overdue (e.g., 2× their review cycle) surface as "review required" with a stronger acknowledgment step.

### 4.4 Local-Fork Drift Detection

When a venue's derived template has diverged significantly from its parent, and the parent has been updated since the derivation, the drift may have accumulated to the point where the local fork no longer accurately reflects any coherent operational intent.

**Drift detection signals:**
- The local fork differs from the current parent in more than N% of configuration fields
- The parent has been updated more than M times since the fork without the fork being reviewed
- The operational outcomes of the local fork are statistically diverging from the fleet average for the same template type

**Drift response:** The operator is shown a "review your derived configuration" prompt with a side-by-side comparison of the local fork vs. the current parent, and an explanation of what has changed in the parent since the fork.

---

## Section 5 — Template Review UX

### 5.1 Preview-Before-Adoption

No template should be applied without a preview of what it will produce in the current operational context. The preview uses actual PRE evaluation — not a simulated representation.

**Preview requirements:**
- For scheduling templates: the effective state for the next 24 hours under the template's configuration
- For sponsorship templates: the projected SOV delivery for the remaining contract period
- For emergency presets: the content that would activate and the scope it would affect
- For onboarding presets: the full initial operational state the venue would begin in

The preview must also show: what the current state is, and what will change if the template is applied.

### 5.2 Impact Simulation

Beyond the preview of the template's intended effect, the platform should simulate potential impact in edge-case conditions the template may not have anticipated.

**Impact simulation queries:**
- "What happens if an emergency override is applied during a period this template governs?"
- "What happens if the content referenced by this template is unavailable?"
- "What happens at the schedule transitions this template creates? Are there gaps?"
- "What is the SOV delivery for this template's configuration if a sponsor override is also active?"

Impact simulation is not exhaustive — it checks the highest-risk edge cases relevant to the template type.

### 5.3 Replay-Backed Validation

Where a template has been applied previously, the historical replay record provides the strongest validation evidence. "This template was applied at Venue X on [date]. Here is what it produced."

**Replay validation link:** Every template with deployment history should show a "view past application" link that opens a replay investigation of the most recent or most successful application, pre-annotated with the key operational events during that period.

This gives template applicants direct evidence of what the template will likely produce — not a theoretical description, but a documented historical outcome.

### 5.4 Operational Confidence Scoring

A template's operational confidence score is a composite indicator of its reliability:
- Review recency (how recently was it validated?)
- Application history (how many times has it been applied without incident?)
- Assumption stability (are its core assumptions stable?)
- Blast radius (what is the scope of impact if it fails?)
- PRE preview match rate (when previewed against its prior applications, how well do predicted and actual states match?)

**Confidence score display:** A visible indicator alongside each template in the selection interface — not a single number, but a multi-dimensional summary that helps operators make informed adoption decisions.

---

## Section 6 — Human Factors

### 6.1 Copy-Paste Operational Culture

In operational environments under time pressure, copying what worked before is a rational strategy. "It worked last time, so apply it again" is efficient and usually correct. The danger is that the conditions that made it work last time may have changed, and the copied configuration encodes assumptions about those conditions that are no longer valid.

**Design response:** The preview-before-adoption step is the primary defense against unreflective copy-paste culture. An operator who can see "this template will create these effects in the current context" before applying it has the opportunity to notice when the context has changed.

### 6.2 Template Mythology

Template mythology occurs when a template accrues status as "the right way to do it" that is disproportionate to its evidence base. The template was created by a respected operator, or it solved a memorable problem, or it's simply been around longest — and these facts give it authority that its current operational accuracy may not support.

**Design response:** Operational confidence scoring (Section 5.4) and staleness detection (Section 4.3) make template quality visible regardless of template reputation. The review cycle ensures that templates must earn their continued authority through demonstrated operational performance.

### 6.3 Inherited Bad Assumptions

Bad assumptions can be inherited through template lineage — each derived template inherits the parent's assumptions, and each subsequent derivation inherits from there. An assumption that was incorrect three generations ago may still be present in current deployments, and no one in the current operational team was present when the assumption was made and may not know it exists.

**Design response:** The modification lineage record (Section 3.3) traces every change from the earliest ancestor, making inherited assumptions visible. The assumption stability classification (Section 4.2) prompts periodic review of conditional and volatile assumptions.

### 6.4 Operational Cargo Cults

Operational cargo cults occur when operators perform specific operational patterns because those patterns are traditional or associated with past success — without understanding why the patterns work or whether they are still appropriate. "We always run the Friday night template on Saturday nights too" is a cargo cult response when no one knows why the Friday template was selected for Saturday.

**Design response:** Template documentation requirements create paper trails that prevent cargo cult formation. When every template has an explanation of what it does and why it was created, cargo cult adoption requires the adopter to read past the explanation rather than just clicking apply. Documentation doesn't prevent cargo cults, but it slows their formation and provides material for breaking them.

---

*End of TEMPLATE-AND-PRESET-GOVERNANCE-v1.md v1.0*
*Authority: Agent 3 (review UX). Template policy classifications require Agent 2 review. Template PRE compliance requires Agent 1 review.*
*Maintained by Agent 3 with Agent 2 stewardship of the template library governance policy.*
