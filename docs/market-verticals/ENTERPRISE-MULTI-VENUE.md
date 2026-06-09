# ClubHub TV — Market Vertical: Enterprise Multi-Venue Operations

**Document type:** Operational profile
**Vertical:** Enterprise multi-venue — chains, franchise groups, multi-site enterprises
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Enterprise multi-venue operations are the governance and fleet management layer that sits above individual venue operations. The platform serves enterprises that range from two or three venues managed by a single owner to national chains with hundreds of sites, regional structures, franchise relationships, and dedicated content teams.

The enterprise vertical is not a distinct content vertical in the same sense as licensed clubs or golf courses — it is an operational model that applies to any enterprise deploying multiple venues across any combination of the other verticals. An enterprise that operates twelve clubs and three hotels has enterprise-level content governance needs that span both verticals simultaneously.

The defining concerns at the enterprise level are:

1. **Constitutional authority**: Who is authorized to create, modify, and deploy content at each resolution level? The PRE resolution hierarchy (L0–L6) maps directly to an authority hierarchy. Misalignment between organizational authority and PRE authority level is a governance failure.

2. **Fleet consistency**: Brand and compliance content must be consistent across all venues. A campaign that runs with correct imagery at 11 venues and broken imagery at one venue is an enterprise problem, not a venue problem.

3. **Safe rollout**: New corpus versions must be deployable to large fleets without risk of fleet-wide content failure. The canary promotion path is the mechanism for this.

4. **Operator autonomy boundaries**: Venue operators need enough control to manage daily operations; they must not have enough control to override brand, compliance, or governance constraints set by the enterprise.

5. **Fleet observability**: The enterprise admin must be able to see the operational health of the entire fleet — entropy events, constitutional states, screen health — without reviewing each venue individually.

---

## 2. Enterprise Operating Models

### 2.1 Centralized

All content managed at HQ. Venue operators have read-only or very limited override access. Content decisions (campaigns, schedules, templates) are made by the enterprise content team and pushed to all venues.

**When appropriate:** Brand environments where consistency is paramount and venue-level variation is not desired. Fast food chains with standardized menus. National retail hospitality brands with strict brand governance.

**PRE authority mapping:**
- ENTERPRISE_ADMIN: L1–L5 content authority (complete control)
- VENUE_OPERATOR: L6 only (local cache fallback content only, if anything)
- REGIONAL_MANAGER: Read visibility and approval escalation, limited L3 authority for regional promotions

**Advantages:** Maximum brand consistency. Compliance content is uniform across fleet. Simple governance model.

**Disadvantages:** Zero responsiveness to local conditions. A venue operator who needs to 86 an item or respond to a local incident is dependent on HQ. Operational latency in emergencies is a risk.

**Emergency exception:** Even in fully centralized deployments, VENUE_EMERGENCY activation MUST be delegable to the venue level. A venue operator who cannot activate a local emergency response because HQ holds all content authority is a safety failure, not a governance feature.

### 2.2 Federated

Venues have significant operational autonomy. The enterprise sets guardrails (brand identity at L5, compliance content at L1 where applicable, enterprise campaigns at L3 with a minimum presence guarantee) but venue operators manage daily operations freely within those boundaries.

**When appropriate:** Franchise groups where franchisees are sophisticated operators. Enterprise groups where venue managers are experienced and trusted. Multi-vertical enterprises where venue operational contexts differ significantly.

**PRE authority mapping:**
- ENTERPRISE_ADMIN: L1–L3 authority (brand, compliance, enterprise campaigns)
- REGIONAL_MANAGER: L3 authority for regional campaigns and templates
- VENUE_OPERATOR: L3–L6 authority (venue campaigns, venue schedules, local overrides, cache)

**Advantages:** Venue operators can respond to local conditions. Faster response to daily operational needs. Respects the expertise of experienced venue operators.

**Disadvantages:** More complex governance. Brand drift risk (venues customize in ways that diverge from brand guidelines). Requires more sophisticated operator training.

### 2.3 Hybrid

The most common real-world model. Enterprise manages brand and compliance content; venues manage local operational content. The boundary between enterprise and venue authority is negotiated based on the specific enterprise's governance requirements.

**Typical hybrid mapping:**
- L0: Enterprise emergency (fleet-wide) AND venue emergency (local) — both delegated
- L1: Enterprise only — compliance content, brand compliance
- L2: Venue — daily schedule, local operations
- L3: Enterprise for seasonal/brand campaigns; venue for local promotional campaigns
- L4: Typically venue (sponsor relationships are often local)
- L5: Enterprise — brand defaults
- L6: Device — local cache

The hybrid model is the reference model for this document. Specific enterprise configurations may deviate; the hybrid model represents typical commercial reality.

---

## 3. Fleet Governance

### 3.1 Canary Promotion in Enterprise Context

New corpus versions (updated campaigns, new seasonal content, PRE configuration changes) must be promoted safely across a large fleet. The canary promotion path is:

```
SHADOW_ONLY → INTERNAL_CANARY → SINGLE_VENUE → MULTI_VENUE → FLEET_WIDE → AUTHORITATIVE
```

At enterprise scale, each stage has specific approval requirements:

| Stage | Approver | Dwell time | What is verified |
|---|---|---|---|
| SHADOW_ONLY | System (automatic) | Until parity confirmed | No divergence from expected resolution |
| INTERNAL_CANARY | ENTERPRISE_ADMIN review | 24–48 hours | Visual review on internal/test screens |
| SINGLE_VENUE | ENTERPRISE_ADMIN explicit approval | 48–72 hours | Pilot venue operator confirms correctness |
| MULTI_VENUE | REGIONAL_MANAGER confirmation | 5–7 days | Regional pilot: cross-venue parity check |
| FLEET_WIDE | ENTERPRISE_ADMIN explicit approval | Active monitoring | Fleet-wide entropy monitoring |
| AUTHORITATIVE | ENTERPRISE_ADMIN sign-off | Final | Current corpus version for fleet |

**Human approval gates:** Transition from MULTI_VENUE to FLEET_WIDE and from FLEET_WIDE to AUTHORITATIVE require explicit human approval by ENTERPRISE_ADMIN. These transitions cannot be automated. The approval record (who approved, when, what corpus version) is part of the audit trail.

**Rollback authority:** Any ENTERPRISE_ADMIN can roll back the fleet to the previous AUTHORITATIVE corpus version. A REGIONAL_MANAGER can roll back venues within their region. A VENUE_OPERATOR can roll back to the previous corpus version for their venue. Rollback is not automatically promoted — it must be explicitly re-promoted through the canary path if it is to become the new AUTHORITATIVE version.

### 3.2 Fleet Emergency

An enterprise-wide emergency (e.g., a brand recall, a regulatory emergency affecting all venues, a national security event) requires fleet-wide L0 activation. This is an ENTERPRISE_ADMIN-only action. The mechanism:

1. ENTERPRISE_ADMIN activates fleet emergency from the enterprise dashboard
2. L0 emergency context is propagated to all venues in the enterprise
3. All venue screens transition to enterprise emergency content within polling cycle
4. ENTERPRISE_ADMIN manages the emergency centrally and lifts it when appropriate

Fleet emergency does not suppress local venue emergency capability. A venue that has already activated a local VENUE_EMERGENCY will continue showing local emergency content — the fleet emergency applies to venues not in active local emergency. When the fleet emergency is lifted, venues return to their pre-emergency resolution state.

### 3.3 Fleet Entropy Monitoring

The enterprise dashboard shows fleet entropy status as an aggregate view:

- **Fleet health summary:** Count of venues by constitutional state (HEALTHY, DEGRADED, CONSTITUTIONAL_RISK, EMERGENCY_FREEZE)
- **Entropy hotspots:** Venues with active MEDIUM or HIGH entropy events, ranked by severity
- **Corpus version map:** Which venues are running which corpus version (important during canary promotions — the enterprise must know that the FLEET_WIDE version has propagated to all venues)
- **Screen health:** Fleet-wide count of HEALTHY, DEGRADED, UNHEALTHY screens

The fleet entropy scan runs every 6 hours. For enterprise contexts with more than 20 venues, the scan is staggered to avoid all venues scanning simultaneously.

**Entropy escalation in enterprise context:**
- CRITICAL entropy at a single venue: escalated to the relevant REGIONAL_MANAGER and ENTERPRISE_ADMIN immediately
- CRITICAL entropy at 3+ venues simultaneously: escalated as potential systemic issue to ENTERPRISE_ADMIN
- MEDIUM entropy at 20%+ of venues simultaneously: escalated as potential systemic issue (could indicate a corpus delivery problem)

### 3.4 Deployment Groups

Large enterprises organize their fleet into deployment groups for corpus version management. A deployment group is a named collection of venues that receive corpus updates together.

Typical deployment group structures:

**By region:**
- `group_qld_north` — 8 venues in North Queensland
- `group_qld_south` — 12 venues in Southeast Queensland
- `group_nsw_metro` — 6 venues in Sydney metro

**By venue type:**
- `group_clubs` — all club venues in the enterprise
- `group_hospitality` — hotel and restaurant venues

**By operational tier:**
- `group_tier1_flagship` — flagship venues (highest traffic, strictest content governance)
- `group_tier2_standard` — standard venues
- `group_tier3_remote` — remote venues (higher offline resilience requirements)

Deployment group targeting allows ENTERPRISE_ADMIN to promote a corpus version to a specific group without affecting the rest of the fleet. This is particularly valuable during regional seasonal campaigns (a Queensland summer campaign should not roll out to Tasmania venues simultaneously).

---

## 4. Franchise Considerations

### 4.1 Authority Partitioning

In a franchise arrangement, the franchisor and franchisee have distinct authority domains:

| Domain | Authority holder | PRE levels |
|---|---|---|
| Brand identity | Franchisor | L5 (default corpus) |
| Compliance content | Franchisor | L1 (regulatory) |
| Core promotional campaigns | Franchisor | L2–L3 (franchise-mandated campaigns) |
| Local operational content | Franchisee | L3–L4 (local campaigns, sponsors) |
| Daily operations | Franchisee (VENUE_OPERATOR) | L2 (local schedule), L6 (local cache) |

The franchisor cannot be overridden at L1 or L5. This is constitutional, not policy — PRE's resolution hierarchy enforces it without requiring a policy rule.

A franchisee who creates a local L3 campaign cannot remove or replace the franchisor's L2 content. A franchisee who configures L4 sponsor slots cannot suppress the franchisor's L5 brand default. These constraints are not enforced by trust — they are enforced by the PRE resolution algorithm.

### 4.2 Franchisee as ENTERPRISE_ADMIN for Their Venues

A large franchisee operating 10 venues may hold ENTERPRISE_ADMIN authority for those 10 venues — meaning they can manage enterprise-level governance for their venue subset. They can run canary promotions across their own venues, create regional campaigns for their territory, and manage their own fleet.

However, the franchisor's authority (L1–L2 franchisor content) is set at the organization level, above the franchisee's ENTERPRISE_ADMIN scope. The franchisee's ENTERPRISE_ADMIN authority applies only within the L3–L6 space that the franchisor's configuration has granted to the franchisee entity.

### 4.3 Brand Compliance Audit

The franchisor can audit content compliance across all franchisee venues:
- Brand imagery compliance: are all venues displaying the current brand default content at L5?
- Compliance content: are all venues running the correct L1 content for their jurisdiction?
- Campaign compliance: are mandated enterprise campaigns active across all venues?

The audit is a PRE replay against each venue's current SystemState. The franchisor does not need to visit venues physically — the deterministic replay gives them exactly what each screen is showing at any point in time. A brand compliance audit for 50 venues can be completed in minutes from the enterprise dashboard.

---

## 5. Multi-Vertical Enterprise Operations

An enterprise group that operates clubs AND hotels AND restaurants faces an additional complexity: the content corpus and operational profiles are fundamentally different across verticals, but the enterprise governance layer is shared.

### 5.1 Corpus Configuration per Vertical

Each vertical has its own corpus structure. A club venue corpus includes L1 responsible gambling assets, jackpot variables, and compliance corpus content that is entirely absent from a hotel venue corpus. The enterprise must maintain separate corpus configurations for each vertical.

The enterprise corpus library is organized by vertical:
- `corpus/clubs/` — club-vertical templates, compliance assets, jurisdiction variants
- `corpus/hospitality/` — hotel and resort templates, language variants, conference templates
- `corpus/food_beverage/` — restaurant and bar templates, menu board structures
- `corpus/shared/` — brand identity assets used across all verticals

Enterprise campaigns that apply across all verticals (e.g., enterprise-wide brand refresh) must be versioned and deployed separately per vertical corpus. A brand refresh asset for clubs may need different dimensions, framing, or content than the same brand refresh asset for the hotel lobby. The enterprise content team must produce vertical-specific variants.

### 5.2 Shared Enterprise Identity

Despite vertical-specific corpus content, the enterprise identity layer (L5 brand defaults, enterprise color system, logo variants) is managed centrally and deployed uniformly. The enterprise admin maintains a single authoritative set of brand assets that flow into the L5 default of every vertical's corpus.

When the enterprise updates its brand identity (new logo, new color palette), the update is deployed via the standard canary path. The cross-vertical parity check (see below) ensures the brand update is visually consistent across all verticals before FLEET_WIDE promotion.

### 5.3 Cross-Vertical Parity Check

Before FLEET_WIDE promotion of any corpus version that affects multiple verticals, a cross-vertical parity check must be completed. The check verifies:
- The updated content renders correctly on screen dimensions used in each vertical (clubs, hospitality, and restaurant screens may have different aspect ratios or resolutions)
- The content is appropriate for the context of each vertical (brand content appropriate in a hotel lobby may be inappropriate in a club gaming room)
- No vertical's compliance requirements are violated by the update

The parity check is a multi-venue canary review stage, not an automated test. A human reviewer must confirm correctness for each vertical context. The ENTERPRISE_ADMIN explicitly confirms parity before FLEET_WIDE promotion.

---

## 6. Enterprise Reference Examples

### 6.1 Premier Clubs Ltd — 12 Clubs, 3 Regions

**Enterprise structure:**
- 12 licensed club venues across three states (QLD: 5, NSW: 4, VIC: 3)
- 3 regional managers (one per state)
- 1 enterprise content team (ENTERPRISE_ADMIN authority)
- 2 operational support staff who assist venue operators

**PRE authority mapping:**

| Role | Level | Scope |
|---|---|---|
| ENTERPRISE_ADMIN (content team) | L1–L5 | All 12 venues |
| REGIONAL_MANAGER QLD | L3 | 5 QLD venues |
| REGIONAL_MANAGER NSW | L3 | 4 NSW venues |
| REGIONAL_MANAGER VIC | L3 | 3 VIC venues |
| VENUE_OPERATOR | L2–L4 | Their individual venue |

**Operating model:** Hybrid — enterprise manages compliance content (L1), brand defaults (L5), and national seasonal campaigns (L3 enterprise). Regional managers run state-specific campaigns (e.g., QLD racing season campaign, VIC AFL finals campaign). Venue operators manage daily operations (jackpot state, raffle coordination, local events).

**Compliance corpus:** Each venue has jurisdiction-specific L1 content (QLD: OLGR format, NSW: ClubSafe format, VIC: GameSafe format). The enterprise content team is responsible for updating all jurisdictions when regulatory requirements change. Updates go through the standard canary path, with SINGLE_VENUE testing in each jurisdiction before FLEET_WIDE promotion within that jurisdiction's venue group.

**Jackpot corpus:** Each venue manages its own jackpot state (VENUE_OPERATOR). The enterprise content team provides the jackpot display template; the venue operator provides the live jackpot values via the gaming management system integration.

**Typical weekly workflow:**

Monday:
- Enterprise content team reviews weekend entropy reports across all 12 venues
- QLD regional manager reviews QLD venues for any operational issues
- National weekly specials campaign activates (configured by enterprise content team on Friday)

Wednesday:
- Enterprise content team activates any mid-week campaign updates
- Venue operators manage their individual operational content (raffle draws, sports schedules, event promotion)

Friday:
- Enterprise content team prepares next week's national campaign
- Regional managers approve regional campaigns for the coming week
- Venue operators prepare weekend event programming

**Canary example — AFL Finals seasonal campaign:**

1. Enterprise content team creates "AFL Finals 2026" campaign with state-specific variants (VIC venues get different imagery than NSW venues, which get different imagery than QLD venues)
2. SHADOW_ONLY → INTERNAL_CANARY: enterprise content team reviews on test screen set
3. SINGLE_VENUE: the Melbourne venue (VIC) runs the campaign for one week. VIC regional manager reviews and approves.
4. MULTI_VENUE: all 3 VIC venues, all 4 NSW venues run the campaign for 5 days. Regional managers confirm.
5. FLEET_WIDE: ENTERPRISE_ADMIN approves. All 12 venues activate.
6. AUTHORITATIVE: signed off by ENTERPRISE_ADMIN.

Total promotion time: approximately 2 weeks from creation to AUTHORITATIVE. The finals campaign is prepared 4 weeks before the season begins, leaving 2 weeks of preparation buffer.

---

### 6.2 Golf Management Group — 6 Courses, 1 Enterprise Admin, Tournament Calendar

**Enterprise structure:**
- 6 golf course venues (3 private clubs, 2 resort courses, 1 public municipal course)
- 1 enterprise administrator (Golf Management Group operations director)
- 6 head pros (one per course, VENUE_OPERATOR authority)
- 2 tournament coordinators (shared across all courses, REGIONAL_MANAGER equivalent authority for tournament content)

**Operating model:** Federated — the enterprise sets brand defaults and manages the tournament calendar at the enterprise level. Individual head pros manage daily course operations, course conditions, and venue events.

**Tournament calendar corpus:**

Golf Management Group operates a shared tournament calendar: each month, one or more of the six courses hosts a Group event (interclub pennant, corporate tournament, pro-am). The tournament coordinators manage the corpus for all Group events centrally.

Tournament event lifecycle at the enterprise level:

| Stage | Lead time | Enterprise action |
|---|---|---|
| Tournament announced | 8 weeks | Create tournament content package, assign to venue |
| Draw confirmed | 2 weeks | Upload draw and pairings assets |
| Day before | 24 hours | Finalize content package, validate against course screens |
| Tournament day | Real-time | Tournament coordinator activates state transitions |
| Post-tournament | 48 hours | Publish results content, archive tournament corpus |

The tournament content package is created once at the enterprise level and assigned to the host course. The host course's head pro confirms the content is correct for their venue (correct course name, correct logo, correct local rule references) before the package is activated. The head pro does not create tournament content; they approve it.

**Course-specific corpus:**

Each of the six courses has a distinct corpus configuration:
- Private clubs: member-oriented content, member event programming, private tournament results
- Resort courses: guest-focused content, accommodation packages, pro shop retail
- Municipal course: public-facing content, community programming, affordable golf promotion

The enterprise brand identity applies across all six courses (shared L5 defaults). Tournament content (L2 schedule during tournament context) is course-specific but created at the enterprise level.

**Canary example — New scoring display format:**

Golf Management Group decides to update the tournament leaderboard display format across all six courses (new font, new color scheme, sponsor logo placement updated per contract).

1. Enterprise admin creates updated leaderboard template in the shared corpus
2. SHADOW_ONLY: parity verification against current leaderboard template
3. INTERNAL_CANARY: tournament coordinators review on a test screen
4. SINGLE_VENUE: the public municipal course (lowest stakes) runs the new leaderboard template during their next interclub event. Tournament coordinator confirms it looks correct. Head pro approves.
5. MULTI_VENUE: three courses run the new template at their next events. Cross-venue parity check confirms consistent rendering across different screen hardware at the different courses.
6. FLEET_WIDE → AUTHORITATIVE: enterprise admin approves.

**Weather emergency coordination:**

Each course can activate a local lightning warning independently (head pro or marshal uses the marshal app). The enterprise admin cannot activate a fleet-wide lightning warning across all six courses simultaneously — that is not a realistic emergency scenario for a distributed fleet of golf courses under different local weather conditions. Each venue's lightning warning is independent.

The enterprise admin can see the real-time constitutional state of all six courses from the fleet dashboard. If multiple courses activate lightning warnings simultaneously (unusual weather event), the dashboard shows this and the operations director can coordinate messaging to course management centrally.

---

## 7. Cross-Vertical Enterprise Design Requirements

The following requirements should inform platform design for enterprise multi-venue deployments:

### 7.1 Role Inheritance Model

Enterprise authority does not automatically grant sub-organization authority. A user with ENTERPRISE_ADMIN for Premier Clubs Ltd does not automatically have VENUE_OPERATOR access to individual venues unless that authority is explicitly delegated. The role model must be granular:

- ENTERPRISE_ADMIN: creates and publishes L1–L5 content; manages fleet; approves canary promotions; activates fleet emergencies
- REGIONAL_MANAGER: manages L3 content within region; approves regional canary stages; reviews regional entropy; cannot modify enterprise L1 or L5 content
- VENUE_OPERATOR: manages L2–L4 at their venue; activates local emergencies; cannot modify regional or enterprise content above their authority level

A user can hold multiple roles: a head pro at a golf course may be VENUE_OPERATOR for their course and REGIONAL_MANAGER for tournament content across multiple courses.

### 7.2 Audit Trail at Enterprise Scale

Enterprise-level audit requirements are stricter than single-venue requirements. The audit trail must capture:
- All enterprise-level content creation and modification (creator, timestamp, corpus diff)
- All canary stage approvals (approver, timestamp, corpus version)
- All fleet emergency events (activator, affected venues, duration)
- All rollback events (who rolled back, from what version, to what version, affected venues)

The audit trail must be queryable by enterprise without reviewing individual venue logs. An enterprise compliance review should be able to answer: "Show me every modification to L1 content across all venues in the last 6 months" in a single query.

### 7.3 Enterprise Template Library

The enterprise template library is the primary mechanism for maintaining operational consistency across a large fleet. Requirements:
- Templates are versioned — a template update does not automatically replace deployed instances of the previous version; venues must explicitly adopt the new version
- Template versioning follows the same canary path as corpus versions
- Venues can view which template version they are running and compare it to the current enterprise version
- An out-of-date template on a venue is a MEDIUM entropy advisory, not a CRITICAL event (venues may legitimately defer template updates for operational reasons)

### 7.4 Franchise Boundary Enforcement at Platform Level

The platform must enforce franchise authority boundaries at the system level, not by policy or trust:
- A VENUE_OPERATOR authenticated for Venue A cannot create content that targets Venue B
- A franchisee ENTERPRISE_ADMIN cannot create content at resolution levels above the franchisor's granted ceiling (enforced by the token scope of the franchisee's enterprise credentials)
- A regional campaign created by REGIONAL_MANAGER X cannot target venues outside their regional authority scope

These are not UX guardrails — they are contract-enforced authorization rules. An API call that violates authority scope is rejected with an authorization error, not silently accepted and ignored.

### 7.5 Corpus Delivery Reliability at Scale

Delivering corpus updates to hundreds of venues simultaneously requires reliable delivery infrastructure. Enterprise-specific requirements:
- Delivery is staggered across deployment groups to avoid simultaneous load spikes
- Delivery status is tracked per venue: which venues have confirmed receipt of the current corpus version
- A venue that has not confirmed receipt within 30 minutes of a corpus push is flagged for investigation
- The fleet dashboard shows corpus version map: ENTERPRISE_ADMIN can see at a glance which venues are running the current version and which are pending

Corpus delivery failure at a single venue is a venue-level MEDIUM entropy event. Corpus delivery failure at 10%+ of the fleet is a systemic issue requiring immediate ENTERPRISE_ADMIN investigation — it likely indicates an infrastructure problem rather than isolated venue network issues.
