# ClubHub TV — Agency Management

**Document type:** Business governance specification
**Authority:** Platform governance — operational layer
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, agency operators, legal/compliance teams
**Depends on:** MULTI-BRAND-ISOLATION.md, SPONSORSHIP-GOVERNANCE.md, ENGINEERING-CONSTITUTION-v1.md, SECURITY_MODEL.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. The Agency Model

An agency in the ClubHub TV context is a third-party organization that manages platform operations — content, campaigns, schedules, and sponsorships — on behalf of one or more enterprise clients.

Common agency types in ClubHub TV markets:
- **Media agencies:** Managing advertising campaigns and sponsorship configurations for enterprise clients
- **AV/content agencies:** Managing creative assets, campaign templates, and content libraries
- **Hospitality management companies:** Operating venue systems on behalf of venue ownership groups (e.g., a hotel management company operating screens for a property ownership trust)
- **Franchise marketing organizations:** Managing brand-level campaigns for a franchise network's franchisee venues

The agency model exists because enterprise clients often lack the operational staff to manage their platform directly. Agencies provide that operational capability while the enterprise client retains strategic control and commercial accountability.

---

## 2. Agency Governance Principles

Three principles govern all agency operations on the platform:

**Principle 1 — Accountability stays with the client.** The enterprise client is always the accountable party for everything that happens within their enterprise on the platform. An agency acting on their behalf does not transfer accountability. If an agency makes a configuration error that suppresses compliance content, the enterprise client is responsible for that error on the platform. Commercial accountability between client and agency is a separate matter outside the platform.

**Principle 2 — The client's ENTERPRISE_ADMIN always retains authority.** No delegation of authority to an agency removes that authority from the enterprise client. The client's ENTERPRISE_ADMIN can always step in, review, modify, override, or revoke agency actions. Delegation is additive — it creates a parallel authority channel for the agency, it does not transfer the client's authority away.

**Principle 3 — Agency actions are fully auditable.** Every action an agency user takes within a client's enterprise is recorded in the client's audit log with the agency user's identity and the agency organization's ID. The client can see exactly what the agency has done, when, and what it changed. There is no "agency back-channel" that bypasses audit.

---

## 3. Agency Registration and Onboarding

### 3.1 Agency as a Principal Organization

An agency is registered in the platform as a **principal organization** — a distinct entity separate from any enterprise client. The agency organization record exists independently of the client relationships it holds.

Agency registration is performed by PLATFORM_ADMIN. The registration process establishes:
- Agency name, registered details, and primary contact
- The PLATFORM_ADMIN who approved the registration (accountability anchor)
- The date of registration
- Any platform-level restrictions on the agency's scope (e.g., approved to operate in specific verticals only)

Agency registration does not grant the agency any access to client data. Access is granted separately by each client's ENTERPRISE_ADMIN.

### 3.2 Client-Agency Relationship Establishment

The client-agency relationship is established by the **client's ENTERPRISE_ADMIN**, not by PLATFORM_ADMIN. This is deliberate: the client decides which agency they trust and what authority that agency holds. PLATFORM_ADMIN establishes that the agency is a recognized entity; the client decides the terms of the relationship.

The establishment process:
1. Client's ENTERPRISE_ADMIN selects the agency from the registered agencies list
2. Client's ENTERPRISE_ADMIN selects one or more agency users to grant access to
3. Client's ENTERPRISE_ADMIN assigns a role and scope for each agency user:
   - Role: ENTERPRISE_ADMIN, REGIONAL_MANAGER, or VENUE_OPERATOR (SPONSOR_STAKEHOLDER is not appropriate for agency users who are managing content on the client's behalf)
   - Scope: which venues, regions, or enterprise-wide
4. The role grant is recorded in the audit log with the granting ENTERPRISE_ADMIN's identity

The client's ENTERPRISE_ADMIN can grant an agency user any role up to and including ENTERPRISE_ADMIN. They cannot grant a role that exceeds their own authority. Only PLATFORM_ADMIN can grant PLATFORM_ADMIN authority.

### 3.3 What Agency Role Grants Enable

An agency user with ENTERPRISE_ADMIN scope for a client enterprise can:
- Create, modify, and publish campaigns within the client enterprise
- Manage scheduling (L2 entries) within the client enterprise
- Configure and activate sponsorships on behalf of the client
- Manage content asset libraries within the client enterprise
- Create and manage REGIONAL_MANAGER and VENUE_OPERATOR user accounts for the client
- Access audit records within the client enterprise
- Preview content in any context within the client enterprise

An agency user with ENTERPRISE_ADMIN scope for a client enterprise CANNOT:
- Modify the role assignments of the client's own ENTERPRISE_ADMIN users (including their own access grant — agencies cannot self-extend their own authority)
- Approve canary promotion to FLEET_WIDE or AUTHORITATIVE stages — this authority is retained by the client's ENTERPRISE_ADMIN (see Section 6.1)
- Trigger constitutional resets (EMERGENCY_FREEZE force-exit) — this authority is retained by the client's ENTERPRISE_ADMIN
- Grant access to other agencies for this client — only the client's ENTERPRISE_ADMIN can add agency relationships
- Transfer any client data to another client context

### 3.4 Agency Access to Compliance-Critical Configuration

Agency users must not configure L1 compliance content without the client's ENTERPRISE_ADMIN review. The platform does not technically prevent an agency ENTERPRISE_ADMIN from modifying L1 content, because the authority is scoped to the role. The governance protection is:

- L1 content modifications are flagged in the audit log with a `compliance_tier_1_modification` event tag
- ENTERPRISE_ADMIN of the client receives an immediate notification when any L1 content is modified
- The notification identifies the agency user who made the change
- The client's ENTERPRISE_ADMIN has a 15-minute review window during which they can revert the change before it propagates to the fleet

This review window is a governance safeguard, not a veto gate — if the ENTERPRISE_ADMIN takes no action, the change proceeds. The mechanism ensures L1 modifications are visible to the client immediately.

---

## 4. Agency Authority Limits

### 4.1 Authorities Agencies Hold (by granted role)

| Action | Agency ENTERPRISE_ADMIN | Agency REGIONAL_MANAGER | Agency VENUE_OPERATOR |
|---|---|---|---|
| Create and publish campaigns (L3) | Yes — enterprise-wide | Yes — regional scope | Yes — venue scope |
| Create schedule entries (L2) | Yes | Yes — regional scope | Yes — venue scope |
| Configure sponsorships (L4) | Yes | Yes — with approval workflow if configured | No |
| Upload and manage content assets | Yes | Yes | Yes |
| Manage VENUE_OPERATOR user accounts | Yes | Yes — regional scope | No |
| Access audit records | Yes | Regional scope | Venue scope |
| Preview content in any context | Yes | Regional scope | Venue scope |
| Modify L1 compliance content | Yes — with client notification | No | No |

### 4.2 Authorities Always Retained by the Client's ENTERPRISE_ADMIN

The following authorities cannot be delegated to an agency. They are always held by the enterprise client's own ENTERPRISE_ADMIN:

**Canary promotion to FLEET_WIDE and AUTHORITATIVE:** These deployment stages affect the entire fleet or certify the deployment as the authoritative production state. The client's own ENTERPRISE_ADMIN must approve these stages. An agency cannot accelerate the client's deployment beyond the canary stages where the client has explicitly authorized agency authority.

**Constitutional resets:** Force-exiting EMERGENCY_FREEZE, acknowledging CRITICAL entropy conditions, and other constitutional state machine interactions require the client's ENTERPRISE_ADMIN. These are not delegatable because they require the client's operational judgment about their own venue's safety.

**Adding new agency relationships:** Only the client's ENTERPRISE_ADMIN can add new agency users or agencies to their enterprise. Existing agencies cannot invite other agencies into the client relationship.

**Modifying their own access grant:** Agency users cannot extend, modify, or renew their own access grant. Only the client's ENTERPRISE_ADMIN can modify agency access.

**Enterprise structure modifications:** Creating new regional organizations, modifying enterprise settings, or changing the enterprise's constitutional configuration requires the client's ENTERPRISE_ADMIN.

### 4.3 Compliance Content: Agency Accountability

Agencies are responsible for the compliance quality of content assets they upload and publish. The platform validates that compliance metadata is present on assets (age ratings, jurisdiction tags, license condition flags). The platform does not validate that the metadata is accurate — that requires human judgment against the actual regulatory requirements for the venue's jurisdiction.

If an agency uploads a content asset with incorrect compliance metadata and the asset is published to L1 slots:
- The platform's audit log records exactly who uploaded the asset and when
- The platform audit records the asset's compliance metadata as declared at upload time
- The client's ENTERPRISE_ADMIN is the accountable party for the deployment
- The agency's liability for the error is a commercial matter between client and agency

Platform governance does not adjudicate commercial disputes between clients and their agencies. It provides accurate records that enable those disputes to be resolved.

---

## 5. Multi-Client Agency Separation

### 5.1 Context Isolation is Total

An agency managing multiple enterprise clients operates in full context isolation between clients. The platform enforces this technically:

- Each operational session is scoped to exactly one enterprise
- An agency user cannot access Client B's data while operating in Client A's context
- There is no multi-client dashboard showing multiple client enterprises simultaneously
- Context switching terminates the current session context before opening the new one

This means an agency user managing 10 clients must work within one client's context at a time. This is intentional — it prevents cross-client contamination of operational decisions and ensures the audit record for each client reflects only that client's activity.

### 5.2 No Cross-Client Operations

The following are not possible through any platform interface:
- Copying a campaign from Client A to Client B (even if the same agency manages both)
- Using Client A's content library to populate Client B's campaigns
- Applying Client A's schedule template to Client B's venues
- Comparing the performance metrics of Client A and Client B in a single view

If an agency wishes to deploy similar campaigns for two clients, the campaign must be created independently within each client's context. Any creative assets must be uploaded separately to each client's content library.

This is not a platform limitation to be engineered around. It is the correct isolation model. An agency that wants to share campaign templates across clients should manage those templates outside the platform (in their own design and production systems) and deploy them separately per client.

### 5.3 Agency-Side Evidence of Context Switching

The audit log records context switches. When an agency user closes a Client A session and opens a Client B session, both events are recorded in their respective enterprise audit logs. This creates an auditable record of the agency's multi-client activity pattern.

This is useful for the client, not as a surveillance mechanism, but as a governance tool: the client can see whether the agency is giving their account the time they are contracted for, and can verify that the agency's activities in their account are consistent with the agreed scope of work.

---

## 6. Constitutional Limits on Agency Authority

### 6.1 Canary Promotion Requires the Client's Own Hand

FLEET_WIDE and AUTHORITATIVE canary stage promotions are constitutional decisions. They declare that a deployment is ready for the full fleet or that it is the authoritative production state. These decisions require the client's ENTERPRISE_ADMIN to personally review and approve.

**Why agencies cannot promote to FLEET_WIDE or AUTHORITATIVE:** An agency's commercial incentive is often to deploy quickly. The constitutional purpose of canary promotion gates is to ensure that someone with accountability for the fleet has reviewed the deployment before it goes fleet-wide. The client's ENTERPRISE_ADMIN carries that accountability. An agency, no matter how trusted or how broadly scoped their authority, does not carry the same accountability for the client's operational fleet.

In practice: an agency ENTERPRISE_ADMIN can promote through canary stages up to the final gate. The final gate requires the client's own ENTERPRISE_ADMIN to approve. The platform enforces this by checking whether the actor performing the promotion is the client's internal ENTERPRISE_ADMIN or an agency-scoped ENTERPRISE_ADMIN.

If the client's enterprise has no internal ENTERPRISE_ADMIN available (e.g., the client entirely outsources operations to the agency), PLATFORM_ADMIN can configure an explicit delegation that allows the agency to approve FLEET_WIDE and AUTHORITATIVE stages for that specific client. This delegation is:
- An explicit PLATFORM_ADMIN configuration, not a default
- Recorded in the audit log as a governance exception
- Reviewed at each quarterly access review

### 6.2 Emergency Authority

An agency user with ENTERPRISE_ADMIN scope can:
- Trigger VENUE_EMERGENCY for a venue within their scope
- Acknowledge operational alerts at their authority level
- Deploy emergency content using pre-configured emergency assets

An agency user with ENTERPRISE_ADMIN scope CANNOT (without explicit PLATFORM_ADMIN delegation):
- Force-exit EMERGENCY_FREEZE
- Acknowledge CRITICAL entropy conditions
- Override constitutional state machine transition requirements

These are retained by the client's ENTERPRISE_ADMIN. If the client's ENTERPRISE_ADMIN is unavailable during an emergency and the agency is the only available operator, the escalation path is to PLATFORM_ADMIN, not to expanding the agency's authority.

---

## 7. Access Review and Revocation

### 7.1 Mandatory Quarterly Access Review

Agency access to client enterprises must be reviewed quarterly. The review is the responsibility of the client's ENTERPRISE_ADMIN.

Review process:
1. Client's ENTERPRISE_ADMIN receives a quarterly access review notification listing all active agency relationships
2. ENTERPRISE_ADMIN confirms each relationship is still active and scoped appropriately
3. Any agency relationships no longer required are revoked
4. The review completion is recorded in the audit log

The platform supports this review by providing:
- A list of all active agency users and their current role/scope within the enterprise
- A summary of each agency user's activity in the past quarter (actions taken, content modified, campaigns published)
- One-click revocation for any agency user

### 7.2 Revocation on Contract Termination

When a client's commercial relationship with an agency ends:
1. The client's ENTERPRISE_ADMIN revokes the agency user's access immediately
2. Revocation is instantaneous — no grace period, no pending access
3. In-progress sessions are terminated
4. The revocation is recorded in the audit log

**What revocation does not do:**
- Delete the agency's work product. Campaigns, content assets, schedule entries, and configurations created by the agency remain in the client's enterprise. These are the client's operational data.
- Erase the audit history. Audit records of the agency's actions remain permanently in the client's audit log. The records cannot be removed even by the client's ENTERPRISE_ADMIN.
- Affect the agency's other client relationships. Revoking access to Client A has no effect on the agency's access to Client B.

### 7.3 Emergency Revocation

If a client determines that an agency user has acted outside their authorized scope or has misused their access:
1. The client's ENTERPRISE_ADMIN can revoke access immediately using emergency revocation
2. Emergency revocation terminates all active sessions immediately without warning
3. The client's ENTERPRISE_ADMIN can flag the revocation as a governance incident
4. PLATFORM_ADMIN is notified of flagged governance incidents for platform-level review

If the governance incident is serious (unauthorized configuration changes, suspected data misuse), PLATFORM_ADMIN can escalate to platform-level investigation using the full audit record.

---

## 8. Agency and Compliance Certification

In licensed venue markets (clubs, hospitality with gaming, sports bars), agencies that manage content for venues with compliance obligations must demonstrate awareness of the compliance requirements that apply to their client's venues.

The platform does not certify agencies for compliance. Compliance certification is a commercial and regulatory matter between the agency, the client, and the relevant regulatory authority.

However, the platform records which agency user published compliance-tier content (L1 content, compliance metadata modifications, jurisdiction configuration changes). This record is available to regulatory authorities if a compliance investigation requires it. Agency users managing licensed venue clients should understand that their L1 content actions are fully traceable.

**Practical guidance for agencies managing licensed venue clients:**
- Always review venue jurisdiction settings before uploading compliance assets (ensure assets carry the correct jurisdiction code)
- Verify `valid_until` dates on all compliance assets are current before publication
- Never modify L1 slot frequency configuration without the client's ENTERPRISE_ADMIN explicit approval
- Use the preview system to verify responsible gambling messaging placement before any campaign that changes the L3-L4 slot mix on licensed venue screens

---

*End of AGENCY-MANAGEMENT.md*
*Role authority matrix: SECURITY_MODEL.md. Canary promotion governance: AUTONOMOUS_ROLLOUTS.md. Audit architecture: docs/system-boundaries/AUDIT-BOUNDARY.md.*
