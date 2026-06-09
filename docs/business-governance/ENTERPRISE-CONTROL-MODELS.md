# ClubHub TV — Enterprise Control Models

**Document type:** Business governance specification
**Authority:** Platform governance — operational architecture layer
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, implementation teams, commercial teams
**Depends on:** MULTI-BRAND-ISOLATION.md, AGENCY-MANAGEMENT.md, SPONSORSHIP-GOVERNANCE.md, ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, AUTONOMOUS_ROLLOUTS.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Enterprise Control Models Overview

Large-scale multi-venue operators on ClubHub TV make a fundamental governance choice: how much content and operational authority do they delegate to individual venues versus retaining centrally? This choice is not binary — it exists on a spectrum from fully centralized (HQ controls everything) to fully federated (each venue is autonomous).

Three archetypes describe the range of real-world enterprise configurations. Most enterprises are closer to Archetype 3 (Hybrid Delegated) than the pure ends of the spectrum. The archetypes serve as reference models — specific enterprises will configure the platform to match their actual governance structure, which may blend elements of multiple archetypes.

**Constitutional invariant across all archetypes:** The PRE resolution hierarchy, constitutional state machine, entropy monitoring, and audit architecture behave identically regardless of which archetype an enterprise adopts. Enterprise control models determine who holds authority within the system. They do not change what the system does with that authority.

---

## 2. Archetype 1 — Centralized Control

### 2.1 Model Description

All content authority is held at the enterprise level. Individual venues are consumers of centrally created and managed content. The enterprise content team creates campaigns, manages schedules, and publishes content. Venues operate within the content environment that HQ creates for them.

VENUE_OPERATORs in a centralized model have limited operational scope:
- Triggering VENUE_EMERGENCY (this is always available to VENUE_OPERATOR — it cannot be revoked)
- Limited local overrides for operational necessities (e.g., a temporary item unavailability notice)
- Operational status monitoring (viewing what is currently playing, checking device health)
- Reviewing and acknowledging local alerts

VENUE_OPERATORs in a centralized model CANNOT:
- Create campaigns
- Modify scheduled content
- Configure or activate sponsorships
- Upload content assets
- Modify any L2 schedule entries

### 2.2 Use Cases

Centralized control is appropriate for:

**Franchise chains with strict brand consistency requirements:** McDonald's, hotel brands, national retail chains. The franchise value is partly in consistent experience. Any venue-level content deviation is a brand consistency failure. HQ controls all content and pushes it to all venues.

**National regulatory compliance scenarios:** Where different venues might make different compliance interpretations, centralizing L1 compliance content management ensures consistent, audited compliance asset management. One team owns compliance assets; venues consume them.

**Small venue operations teams:** Where individual venues have a single duty manager who has many responsibilities and content management is not one they have time for. Centralizing content management removes that cognitive load from venue operators.

### 2.3 Platform Configuration for Centralized Control

| Configuration parameter | Setting |
|---|---|
| VENUE_OPERATOR campaign publish authority | Disabled — campaigns require REGIONAL_MANAGER or ENTERPRISE_ADMIN |
| VENUE_OPERATOR L2 schedule modification | Disabled |
| VENUE_OPERATOR content upload | Disabled (or read-only) |
| Template-driven content | All campaigns use enterprise-approved templates |
| Local override scope | Narrow — defined list of override types (item unavailability, local event notice) |
| Approval workflow | All campaigns require ENTERPRISE_ADMIN or REGIONAL_MANAGER approval before activation |

### 2.4 Risks of Centralized Control

**HQ bottleneck for operational content changes:** When a venue needs a rapid content change (a specials menu change, a last-minute event promotion), the change must flow through HQ. If HQ is slow, the venue cannot respond operationally. This is the most common failure mode of centralized control in hospitality contexts.

**Mitigation:** Define a narrow set of pre-approved local override types (templates with bounded customization) that VENUE_OPERATOR can activate without HQ approval. These are operational, not promotional — they do not represent brand content decisions.

**Single canary deployment group:** A fleet-wide deployment failure in a centralized model affects all venues simultaneously because they all receive the same content from the same deployment pipeline. Canary staging is critical — the constitutional canary gates must be respected. Commercial pressure to "deploy immediately to all venues" must be resisted.

### 2.5 Constitutional Governance for Centralized Enterprises

**Canary promotion:** ENTERPRISE_ADMIN approves FLEET_WIDE and AUTHORITATIVE promotion for the entire fleet. A single approval covers all venues. This means the ENTERPRISE_ADMIN must have high confidence before approving — the fleet-wide canary stage is the critical gate.

**Emergency authority:** VENUE_OPERATOR retains VENUE_EMERGENCY authority regardless of centralized model. HQ cannot remove the venue operator's ability to trigger emergency content. This is a constitutional floor, not a configurable parameter.

**Compliance asset management:** Centralized compliance asset management (all L1 assets managed by ENTERPRISE_ADMIN) is the strongest governance model for compliance-critical environments. It ensures that no L1 asset diverges from the jurisdiction-approved format without ENTERPRISE_ADMIN knowledge.

---

## 3. Archetype 2 — Federated Control

### 3.1 Model Description

The enterprise defines strategic guardrails (brand templates, compliance requirements, prohibited content categories) and then gives individual venues significant campaign and scheduling autonomy within those guardrails. Venues operate within a framework the enterprise has defined, but they make their own day-to-day content decisions.

VENUE_OPERATORs in a federated model have substantial operational scope:
- Full campaign creation and publishing authority (within enterprise templates)
- L2 schedule management for their venue
- Content asset upload (within enterprise content policy)
- Sponsorship configuration for venue-local sponsors (within enterprise sponsorship policy)
- Local override management

VENUE_OPERATORs cannot:
- Override enterprise-level L1 compliance content configuration
- Publish content that violates enterprise content policy guardrails (enforced by policy engine)
- Approve FLEET_WIDE or AUTHORITATIVE canary promotion

### 3.2 Use Cases

Federated control is appropriate for:

**Large hotel groups with distinct local personalities:** A hotel chain where each property has genuine local character and the brand identity allows for local expression. The Noosa Hastings Street property has a different feel from the Cairns Esplanade property. Local content decisions by local operators reflect that distinction.

**Multi-venue club groups where venues have different demographics and programming:** A group operating RSL clubs where venue A has a strong racing culture and venue B has a strong sporting culture. Centralizing content would require HQ to manage two different content strategies simultaneously. Federating allows each venue to manage their own programming within the brand framework.

**Franchise models where franchisee autonomy is a selling point:** Some franchise models compete partly on the basis that franchisees retain meaningful business autonomy. A fully centralized model conflicts with that proposition.

### 3.3 Platform Configuration for Federated Control

| Configuration parameter | Setting |
|---|---|
| VENUE_OPERATOR campaign publish authority | Enabled — within approved templates |
| VENUE_OPERATOR L2 schedule modification | Enabled |
| VENUE_OPERATOR content upload | Enabled — subject to content policy review |
| Template library | Enterprise maintains approved templates; venue customizes within bounds |
| Local sponsorship authority | VENUE_OPERATOR can activate venue-local sponsors within enterprise policy |
| Approval workflow | Configurable by venue: some venues self-publish, others require REGIONAL_MANAGER review |
| Content policy enforcement | Policy engine enforces enterprise guardrails at publish time |

### 3.4 Risks of Federated Control

**Brand consistency drift:** With 20 or 50 venue operators each making independent content decisions, brand consistency can drift over time. What starts as local expression becomes local divergence.

**Mitigation:** Template enforcement at publish time. Venue operators can only publish campaigns built on enterprise-approved templates. The templates define the brand bounds; the local customization happens within those bounds. REGIONAL_MANAGER review of new campaign types catches drift before it becomes systematic.

**Operator training requirement:** More operators with more authority require more training. A venue operator with full campaign authority who does not understand the PRE resolution model may create configuration conflicts (e.g., creating a LEVEL_3 campaign that inadvertently suppresses a compliance slot by targeting the wrong screen zone).

**Mitigation:** Mandatory onboarding training with assessment before VENUE_OPERATOR campaign publish authority is granted. The platform can gate authority grants on training completion.

**Per-venue canary promotion complexity:** In a federated model with significant venue autonomy, deployments may propagate at different rates to different venues. REGIONAL_MANAGER handles local parity — ensuring that venues within their region are at consistent deployment states.

### 3.5 Constitutional Governance for Federated Enterprises

**Per-venue canary promotion:** Each venue's deployment can be individually controlled. REGIONAL_MANAGER can approve canary promotion for venues within their region. ENTERPRISE_ADMIN approves FLEET_WIDE and AUTHORITATIVE.

**Compliance asset management:** Enterprise still manages L1 compliance assets centrally. Venue operators may customize L3-L5 content but cannot modify L1 content regardless of the federated authority model.

**Audit aggregation:** ENTERPRISE_ADMIN's audit dashboard aggregates across all venues. The distributed operational activity of many venue operators creates a higher audit volume. Enterprise-level pattern monitoring (anomaly detection across venues) is important in federated models.

---

## 4. Archetype 3 — Hybrid Delegated Control

### 4.1 Model Description

The most common real-world enterprise configuration. The enterprise manages strategic and compliance-critical content centrally, while delegating tactical and local content management to venues and regional managers.

**Enterprise manages centrally (ENTERPRISE_ADMIN authority):**
- L1 compliance content (all compliance assets managed centrally)
- Brand campaigns (major promotional campaigns that represent the enterprise brand)
- Sponsorship agreements at the enterprise level (sponsors contracted across the fleet)
- Deployment policy (canary promotion thresholds, deployment risk tolerance)

**Regional management has delegated authority (REGIONAL_MANAGER):**
- Regional campaigns (campaigns targeting a subset of venues)
- Regional sponsorships (sponsors contracted for a region)
- Venue operator training and access management for their region
- Parity monitoring and alert response for their regional fleet

**Venues have delegated authority (VENUE_OPERATOR) within enterprise bounds:**
- Local schedule management (L2 entries for venue events and programming)
- Local campaigns within enterprise templates (promotional content for venue-specific events)
- Local overrides for operational necessities
- Venue-local sponsor content (sponsors contracted at the individual venue level)

### 4.2 Authority Matrix

The explicit definition of which level controls which content categories is the most important governance document for a Hybrid Delegated enterprise. Without an explicit authority matrix, the model collapses into either de-facto centralized (ENTERPRISE_ADMIN approves everything) or de-facto federated (venue operators do what they want).

**Example authority matrix for a golf management group:**

| Content category | L0 Emergency | L1 Compliance | L2 Schedule | L3 Campaign | L4 Sponsor |
|---|---|---|---|---|---|
| Who creates | VENUE_OPERATOR | ENTERPRISE_ADMIN | VENUE_OPERATOR | See below | See below |
| Who approves | Immediate — no approval | Compliance review | VENUE_OPERATOR self-approves | See below | See below |
| Who can override | ENTERPRISE_ADMIN+ | ENTERPRISE_ADMIN only | REGIONAL_MANAGER+ | REGIONAL_MANAGER+ | ENTERPRISE_ADMIN |

| Campaign type | Created by | Approved by | Scope |
|---|---|---|---|
| Major brand campaign | ENTERPRISE_ADMIN | ENTERPRISE_ADMIN | Fleet-wide or multi-venue |
| Tournament promotion | REGIONAL_MANAGER | REGIONAL_MANAGER | Regional venues |
| Venue event promotion | VENUE_OPERATOR | VENUE_OPERATOR (self) | Single venue |
| Specials/operational | VENUE_OPERATOR | VENUE_OPERATOR (self) | Single venue |

| Sponsor type | Configured by | Approved by | Scope |
|---|---|---|---|
| Enterprise fleet sponsor | ENTERPRISE_ADMIN | ENTERPRISE_ADMIN | Fleet-wide |
| Regional sponsor | REGIONAL_MANAGER | REGIONAL_MANAGER | Regional venues |
| Venue-local sponsor | VENUE_OPERATOR | REGIONAL_MANAGER review (configurable) | Single venue |

### 4.3 Guardrail Templates

The Hybrid Delegated model depends heavily on enterprise-defined guardrail templates:

**L2 guardrail templates:** Enterprise-created schedule templates that define the structural schedule for a venue type (e.g., "golf club weekday default schedule"). Venues customize within the template by adding their specific events and local programming.

**L3 campaign templates:** Enterprise-approved campaign structures that define the visual bounds (brand colors, fonts, approved image regions) and the targeting parameters (which zones a campaign type may target). VENUE_OPERATOR creates campaigns by populating a template — they cannot create campaigns outside the template structure.

**L4 sponsorship policy:** Enterprise-defined rules for what types of sponsors are eligible for venue-local activation. A golf venue operator may activate a local golf equipment sponsor but not a wagering sponsor (if the enterprise has restricted wagering sponsors to enterprise-level approval only).

### 4.4 Approval Workflows

Hybrid Delegated enterprises typically configure differentiated approval workflows:

- **High-risk content categories** (compliance-adjacent, politically sensitive, legally sensitive): require REGIONAL_MANAGER or ENTERPRISE_ADMIN approval regardless of which level created the content
- **Standard promotional content**: VENUE_OPERATOR self-approves within enterprise templates
- **New content types not covered by existing templates**: require ENTERPRISE_ADMIN review before the template is added

The approval workflow configuration is an ENTERPRISE_ADMIN responsibility. Platform defaults all approval workflows to "require approval" — the ENTERPRISE_ADMIN explicitly enables self-publish authority where they want it.

### 4.5 Constitutional Governance for Hybrid Delegated Enterprises

**Enterprise controls L2-L3 guardrail templates:** The enterprise defines the structural constraints. Venue operators work within those constraints.

**Venue controls L3-L4 local campaigns within enterprise bounds:** Within the approved template structure, venue operators have meaningful autonomy.

**ENTERPRISE_ADMIN always retains override authority:** In the Hybrid Delegated model, as in all models, ENTERPRISE_ADMIN can always step in to any venue, override any content decision, and manage any operational situation. Delegation does not remove this authority.

---

## 5. Enterprise Governance Tooling

### 5.1 Policy Engine

The platform's policy engine allows ENTERPRISE_ADMIN to define content governance rules that are evaluated at content publish time:

**Examples of policy rules:**
- "No content assets containing competitor brand identities may be published to any venue in this enterprise"
- "All content published to gaming room zones must carry `compliance_only: true` metadata"
- "Wagering brand sponsor content requires REGIONAL_MANAGER approval in addition to VENUE_OPERATOR activation"
- "No content asset with `age_rating: 18+` may be published to lobby zone screens"

Policy violations are surfaced at publish time — the content cannot be published until the policy violation is resolved. Policies are not retroactive (they do not affect content already published).

Policy rules are configured by ENTERPRISE_ADMIN and are visible to all operators within the enterprise. Operators can see why their publish was blocked (which policy rule it violated). This transforms policy from an invisible blocker into a governance education mechanism.

### 5.2 Template Library

The template library is the enterprise's primary tool for defining the bounds within which venue operators create content.

Template capabilities:
- Define visual bounds: brand color palette, approved font set, image region constraints
- Define targeting constraints: which zones and venue types a campaign type may target
- Define content category: what classification the campaign's content represents (for policy rule evaluation)
- Define approval workflow: whether campaigns of this template type self-publish or require review

VENUE_OPERATORs can only create campaigns from approved templates. They can customize the campaign within the template's defined bounds (add their specific event details, select from approved images, write within the text region constraints). They cannot create campaigns outside the template structure.

### 5.3 Approval Workflows

Approval workflows are configurable per enterprise and per content category. The platform provides:
- Configurable approval chains (VENUE_OPERATOR creates, REGIONAL_MANAGER approves, for example)
- Parallel approval (two approvers must independently approve a high-risk action)
- Deadline-aware approval (approve within N hours or the action expires)
- Audit record of the full approval chain for any published campaign

Approval workflows apply to campaigns, schedule modifications, sponsorship activations, and policy configuration changes. They do not apply to emergency content (LEVEL_0 — emergency response cannot be gated on approval).

### 5.4 Audit Aggregation

Enterprise-level audit dashboards aggregate operational data across all venues for ENTERPRISE_ADMIN visibility:

- **Fleet activity summary:** All operator actions across all venues in a time window
- **Content change rate:** How rapidly corpus content is changing across the fleet (entropy precursor)
- **Compliance asset health:** Status of all L1 assets across all venues (expired, missing, valid)
- **Sponsorship delivery:** Fleet-wide SOV delivery vs committed SOV for enterprise-level sponsors
- **Canary stage status:** Current deployment stage for all venues and regions

The audit aggregation dashboard is the primary governance tool for ENTERPRISE_ADMIN in a large multi-venue operation. It provides the signal that something needs attention before it becomes a problem that requires intervention.

---

## 6. Constitutional Authority Invariants Across All Archetypes

Regardless of which control archetype an enterprise adopts, the following invariants hold without exception:

### 6.1 ENTERPRISE_ADMIN Always Retains Constitutional Override Authority

In every archetype, ENTERPRISE_ADMIN retains the authority to:
- Trigger emergency content for any venue in the enterprise
- Override any content decision made at any level within the enterprise
- Acknowledge CRITICAL entropy conditions for any venue
- Revoke any operator's access immediately
- Access any audit record within the enterprise

This authority cannot be reduced by the enterprise's own governance configuration. Delegation adds authority to delegatees — it does not reduce the delegator's authority.

### 6.2 Delegation Does Not Remove Authority from the Delegator

A central principle: when ENTERPRISE_ADMIN grants REGIONAL_MANAGER authority to approve campaigns in their region, the ENTERPRISE_ADMIN does not lose that authority. They retain it in parallel with the REGIONAL_MANAGER. Both can approve. Both can override the other's approvals. Authority is additive when delegated.

This principle prevents governance structures that would lock the enterprise out of its own operational systems.

### 6.3 Canary Promotion to FLEET_WIDE and AUTHORITATIVE Always Requires ENTERPRISE_ADMIN Approval

Regardless of control archetype, FLEET_WIDE and AUTHORITATIVE canary promotion requires ENTERPRISE_ADMIN approval. The rationale:

- FLEET_WIDE deploys content to the entire operational fleet. A failure at this stage affects every venue.
- AUTHORITATIVE declares the current state as the canonical production state. This is an irreversible declaration.

Neither decision should be delegated to REGIONAL_MANAGER or VENUE_OPERATOR. ENTERPRISE_ADMIN carries the accountability for the fleet; they make the fleet-level deployment decisions.

If a specific enterprise has determined that REGIONAL_MANAGER should approve regional FLEET_WIDE deployments (where "fleet-wide" is scoped to a region), PLATFORM_ADMIN can configure this explicitly. This is a governance exception requiring PLATFORM_ADMIN justification and audit record.

### 6.4 L1 Compliance Authority is Always ENTERPRISE_ADMIN

Across all archetypes, L1 compliance content management is an ENTERPRISE_ADMIN responsibility. VENUE_OPERATOR cannot modify L1 compliance content. REGIONAL_MANAGER cannot modify L1 compliance content. Even in a fully federated enterprise, compliance content is managed centrally.

This is not a platform restriction on venue autonomy — it is a platform protection for the enterprise. L1 compliance content errors create regulatory exposure. The enterprise bears that exposure. Centralizing L1 authority ensures the enterprise can verify and defend its compliance posture.

---

## 7. Choosing a Control Model

### 7.1 Factors That Push Toward Centralized Control

- Strict franchise brand consistency requirements
- Small venue operations teams with limited content expertise
- Highly regulated content environments (gaming venues, age-restricted venues)
- Low variance in programming across venues (all venues have the same content needs)
- Recent platform adoption (centralized control during onboarding; federate later)

### 7.2 Factors That Push Toward Federated Control

- Venues with distinct local identities and demographics
- Experienced venue operators with strong content judgment
- High variance in programming needs across venues
- Commercial model where local operator autonomy is a differentiator
- Maturity with the platform (appropriate for enterprises with established operational discipline)

### 7.3 Factors That Favor Hybrid Delegated Control

- The enterprise manages compliance and brand but wants local operational responsiveness
- Regional variation exists but is moderate, not extreme
- The enterprise has regional management structure that can carry the REGIONAL_MANAGER authority effectively
- Most common real-world choice for enterprises with 5–50 venues

### 7.4 The Default Starting Point

For enterprises new to ClubHub TV, the recommended starting point is **Centralized Control with a time-limited transition path to Hybrid Delegated.**

Starting centralized:
- Reduces the risk of content errors during platform onboarding
- Allows ENTERPRISE_ADMIN to establish template library and policy rules before delegating
- Gives REGIONAL_MANAGERs time to develop platform familiarity before receiving authority
- Provides a baseline of audit records that show what "good" operation looks like for this enterprise

Transitioning to Hybrid Delegated:
- After 3–6 months of centralized operation, review which content decisions can be safely delegated
- Build the template library before delegating campaign authority
- Grant REGIONAL_MANAGER authority before VENUE_OPERATOR authority
- Audit the first 30 days of delegated operation before fully removing centralized oversight

The platform supports this transition with configurable approval workflow thresholds — ENTERPRISE_ADMIN can progressively reduce oversight as trust is established.

---

*End of ENTERPRISE-CONTROL-MODELS.md*
*Role authority model: SECURITY_MODEL.md. Canary promotion architecture: AUTONOMOUS_ROLLOUTS.md. Policy engine implementation: docs/POLICY_ENGINE.md. PRE resolution levels: PRE-REFERENCE-IMPLEMENTATION-v1.md.*
