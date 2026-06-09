# ClubHub TV — Multi-Brand Isolation

**Document type:** Business governance specification
**Authority:** Platform governance — constitutional layer
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, legal/compliance teams, platform engineering
**Depends on:** SPONSORSHIP-GOVERNANCE.md, ENGINEERING-CONSTITUTION-v1.md, SECURITY_MODEL.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Isolation as a Constitutional Property

Multi-brand isolation is not a feature of ClubHub TV — it is a foundational property of the platform's data and authority model. Every enterprise operates in a fully isolated context. No data, configuration, audit record, content asset, campaign, or operational metric from one enterprise is accessible to another enterprise through any interface the platform exposes.

This isolation holds even when:
- Two enterprises operate venues in the same physical location
- Two enterprises use the same agency to manage their content
- Two enterprises are subsidiaries of the same parent company (unless explicitly unified under a single enterprise record by PLATFORM_ADMIN)
- A PLATFORM_ADMIN is accessing both enterprises simultaneously

Isolation is enforced at the data layer, not only at the application layer. Cross-enterprise queries are not possible through the platform's query interfaces. There is no "view all enterprises" data access pattern available to anyone below PLATFORM_ADMIN.

---

## 2. Full Tenant Isolation Model

### 2.1 Enterprise-Scoped Data Objects

Every major data object in the platform carries an `enterprise_id` scope. The following are always enterprise-scoped:

| Data object | Scope | PLATFORM_ADMIN cross-enterprise access |
|---|---|---|
| Venues | Enterprise | Yes — read only |
| Screens | Enterprise (via venue) | Yes — read only |
| Content assets | Enterprise | Yes — read only |
| Campaigns | Enterprise | Yes — read only |
| Sponsorships | Enterprise | Yes — read only |
| Schedule entries (L2) | Enterprise | Yes — read only |
| Audit records | Enterprise | Yes — read + audit |
| Proof-of-play reports | Enterprise + sponsor scope | Yes — read only (never shared between competing enterprises) |
| Entropy reports | Enterprise | Yes — read only |
| Parity reports | Enterprise | Yes — read only |
| Role assignments | Enterprise | Yes — manage |
| Canary stages | Enterprise | Yes — read only |

PLATFORM_ADMIN cross-enterprise access exists for platform governance purposes only. It is never used to share competitive intelligence between enterprises.

### 2.2 Screen-Level Ownership

A screen belongs to exactly one venue, which belongs to exactly one enterprise. This ownership chain is immutable after assignment. There are no shared screens between enterprises.

If a physical screen needs to be moved from one enterprise to another (e.g., a venue changes management company), this requires PLATFORM_ADMIN action to reassign the venue record. The audit history from the previous enterprise remains in the previous enterprise's audit scope. The new enterprise starts with a clean audit record from the reassignment date.

### 2.3 Content Library Isolation

Enterprise content libraries are private to each enterprise. When a REGIONAL_MANAGER or VENUE_OPERATOR uploads content or creates campaign assets, those assets are scoped to their enterprise. They are not visible, searchable, or accessible from any other enterprise's content library.

**No content sharing mechanism exists between enterprises.** If a brand wishes to provide content to multiple enterprise operators (e.g., a beer brand providing assets to multiple venues), the brand's assets must be uploaded separately to each enterprise's content library by the respective enterprise's operators. There is no "brand content hub" that spans enterprises.

This is intentional. A shared content hub would create a cross-enterprise visibility channel — even for read-only access — that would violate the isolation model.

---

## 3. Brand Competition Scenarios

### 3.1 Competing Hospitality Chains

Two competing hotel chains both operating ClubHub TV in their properties see no trace of each other on the platform. From each chain's perspective, the platform serves only their venues.

- Neither chain can see the other's campaigns, content, pricing, or operational patterns
- Neither chain's ENTERPRISE_ADMIN can discover which other enterprises are on the platform
- Platform-level aggregate metrics (e.g., "total screens deployed nationally") are available only to PLATFORM_ADMIN and are never exposed to enterprise-level users
- If both chains share a geographic market, their relative operational sophistication on the platform is not visible to either

PLATFORM_ADMIN can see both enterprises for platform governance purposes (health monitoring, billing, support escalations). PLATFORM_ADMIN is explicitly prohibited from sharing one enterprise's operational intelligence with another.

### 3.2 Franchise vs Independent Operator

In scenarios where a franchise brand requires all franchisees to use ClubHub TV but individual franchisees retain operational autonomy:

**Model A — Franchisee as sub-enterprise:** Each franchisee is an independent enterprise on the platform. The franchise brand has no platform-level authority over franchisee enterprises. Brand content is distributed via the content upload process per enterprise — no automated cross-enterprise content push exists.

**Model B — Unified enterprise with venue autonomy:** The franchise group registers as a single enterprise. Franchisees are VENUE_OPERATORs within that enterprise. ENTERPRISE_ADMIN (held by the franchise brand) has full authority over all franchise venues. Content can be centrally managed and pushed to all venues.

Which model is appropriate depends on the franchise agreement and the degree of operational control the brand requires. PLATFORM_ADMIN establishes the enterprise structure at onboarding. The platform enforces the resulting authority model mechanically.

**In Model A:** Franchise brand content cannot be mandated through the platform. The franchise relationship is a commercial arrangement that must be managed through the normal content distribution process.

**In Model B:** ENTERPRISE_ADMIN authority is real and complete. The franchise brand's decisions are platform decisions for all venues in the enterprise.

### 3.3 Agency Managing Multiple Competing Clients

An advertising agency may manage content for multiple enterprise clients who are direct competitors. The isolation model applies fully:

- The agency user operating in Client A's context sees only Client A's data
- The same agency user operating in Client B's context sees only Client B's data
- There is no mechanism by which the agency user can transfer insights, content, configuration, or operational data from one client's context to another through platform interfaces
- The agency cannot compare Client A's and Client B's performance on the platform

The isolation is enforced by context switching — each operational session is scoped to exactly one enterprise. The platform does not provide any multi-client comparative view to agency users.

---

## 4. Multi-Brand Enterprise

### 4.1 Single Enterprise Group, Multiple Brands

A common commercial structure is a single enterprise group operating multiple distinct brands (e.g., a hospitality group that operates both a hotel chain and a restaurant chain under different brand identities). These brands may be operationally integrated but commercially distinct.

**Isolation model for multi-brand enterprises:**

The enterprise group registers as a single enterprise. Brand-level isolation is achieved through the internal organizational structure:

- **Regional organizations per brand:** Create separate regional orgs within the enterprise for each brand. Brand-specific content libraries, campaign templates, and sponsorship agreements are scoped to their brand's regional org.
- **REGIONAL_MANAGER authority scope:** Regional managers for Brand A's venues have authority only over Brand A's venues. They cannot see or manage Brand B's venues even though both are within the same enterprise.
- **Cross-brand visibility:** ENTERPRISE_ADMIN has visibility across all brands within the enterprise. This is appropriate — the enterprise group's central leadership has legitimate oversight of all brands.

### 4.2 Cross-Brand Campaigns

Where the enterprise group wishes to run a campaign that spans multiple brands (e.g., a loyalty program campaign that appears at both hotel and restaurant venues):

- ENTERPRISE_ADMIN creates the campaign with explicit multi-brand targeting
- The campaign targets venues from multiple brand regional orgs
- Content assets for the campaign may include both brand identities (if this is the creative intent)
- Proof-of-play for the cross-brand campaign is scoped to the enterprise level (not brand level)

Cross-brand campaigns require ENTERPRISE_ADMIN creation authority — REGIONAL_MANAGER cannot publish campaigns that span beyond their own regional org.

### 4.3 Competing Brands Within the Same Enterprise

In rare cases, an enterprise group may own competing brands that share the same venue (e.g., a hospitality group that owns multiple beer brands and distributes them in its own venues). Within a single enterprise, the isolation model does not apply between brands — ENTERPRISE_ADMIN has full visibility.

However, within the platform, the sponsorship conflict detection system still applies: two competing beer brands from the same enterprise group are subject to category exclusivity detection if the venue has recorded category exclusivity commitments.

---

## 5. Competitive Intelligence Isolation

### 5.1 Proof-of-Play Reports Are Enterprise-Scoped

Proof-of-play reports contain the delivery record for a specific sponsor's content at a specific venue. These reports are scoped to the sponsoring enterprise's SPONSOR_STAKEHOLDER access.

PLATFORM_ADMIN can access all proof-of-play reports for platform governance (e.g., verifying report generation accuracy, supporting dispute resolution). PLATFORM_ADMIN is prohibited from:
- Sharing one enterprise's proof-of-play data with another enterprise or any of their users
- Using enterprise proof-of-play data to generate comparative performance reports visible to other enterprises
- Providing one sponsor's delivery data to a competing sponsor

### 5.2 Performance Metrics and Aggregation

Enterprise-scoped performance metrics (delivered SOV, suppression rates, device uptime) are visible only to the enterprise that generated them.

Platform-level aggregates — total screens deployed, national delivery reliability, platform-wide entropy rates — are visible only to PLATFORM_ADMIN. These aggregates do not expose any individual enterprise's data. They serve platform health monitoring, not competitive analysis.

**PLATFORM_ADMIN may never use platform-level aggregates to infer one enterprise's performance from the remainder.** If there are only two enterprises on the platform, a platform-level aggregate and one enterprise's data together imply the other enterprise's data. PLATFORM_ADMIN must exercise governance judgment about aggregate reporting in small multi-tenant environments.

### 5.3 Audit Records as Competitive Data

Audit records (the append-only hash-chained record of all platform operations) contain rich operational intelligence. They are enterprise-scoped.

PLATFORM_ADMIN can access audit records across enterprises for governance purposes: investigating platform integrity issues, supporting regulatory inquiries, verifying system behavior during incidents.

PLATFORM_ADMIN cannot share audit record data between enterprises. The audit record for Enterprise A is not available to Enterprise B through any platform interface.

---

## 6. Agency Management Isolation

### 6.1 Agency Registration Model

An agency is registered as a **principal organization** in the platform — a first-class entity separate from the enterprise clients it manages. The agency organization record carries:
- Agency name and contact details
- The PLATFORM_ADMIN who approved the agency's registration
- The list of enterprise-client relationships active at any time

The agency organization is not itself an enterprise. It does not operate venues, manage screens, or hold content. It is an authority delegation vehicle.

### 6.2 Client-Agency Authority Delegation

Client-agency relationships are established by the enterprise client's ENTERPRISE_ADMIN, who grants the agency user a scoped role within the client enterprise:

```
ENTERPRISE_ADMIN (client) grants Agency User → REGIONAL_MANAGER for [venue_set]
```

or

```
ENTERPRISE_ADMIN (client) grants Agency User → ENTERPRISE_ADMIN (full scope)
```

The client's ENTERPRISE_ADMIN retains their authority regardless of what authority they delegate to the agency. Delegation adds authority for the agency — it does not remove or transfer the delegating authority away from the client.

### 6.3 Agency Audit Scope

All actions taken by an agency user within a client context are recorded in the client enterprise's audit log. The audit record includes:
- `actor_id`: the agency user's ID
- `actor_type`: `AGENCY_USER`
- `agency_id`: the agency's principal organization ID
- `client_enterprise_id`: the enterprise the action was taken within
- `action`: the specific operation performed
- `timestamp`: when the action occurred

The `agency_id` field enables enterprise clients to filter their audit log to see specifically what their agency has done on their behalf. This is an accountability mechanism for the client's governance of their agency relationship.

### 6.4 Context Switching Enforcement

When an agency user works across multiple client enterprises, each work session is locked to exactly one enterprise context. The platform does not provide:
- A multi-client dashboard showing all client enterprises simultaneously
- Any interface for operating across enterprise contexts in a single session
- Any mechanism for moving content, configuration, or audit data between client contexts

Context switching requires the agency user to explicitly select a different client enterprise, which terminates their current session context and opens a new one. The audit trail records both the close of the previous context and the open of the new one.

### 6.5 Agency Access Review and Revocation

Agency access is not permanent. The client's ENTERPRISE_ADMIN is responsible for reviewing agency access:
- **Quarterly review:** Platform best practice recommends quarterly review of active agency access grants
- **Contract renewal review:** Access should be reviewed when the agency's commercial contract with the client renews or terminates
- **Immediate revocation:** The client's ENTERPRISE_ADMIN can revoke agency access at any time with immediate effect. The revocation is recorded in the audit log. The agency's future actions are blocked from that moment.

**Revocation behavior:**
- The agency user's scoped roles are removed immediately
- Sessions in progress are terminated
- Audit records from the agency's time of access are retained in full — revocation does not erase history
- The agency's content uploads and campaign configurations remain in the client's enterprise (they are the client's operational data, not the agency's)

---

*End of MULTI-BRAND-ISOLATION.md*
*Enterprise isolation enforcement: SECURITY_MODEL.md. Audit record architecture: docs/system-boundaries/AUDIT-BOUNDARY.md, Phase A6 trace store.*
