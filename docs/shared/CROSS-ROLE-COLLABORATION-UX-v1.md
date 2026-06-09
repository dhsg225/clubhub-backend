# ClubHub TV — Cross-Role Collaboration UX
# Shared Operational Intelligence Layer

**Document type:** UX governance — collaborative operational cognition
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** UX contributors, frontend engineers, operational system designers, role/access model owners
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all multi-operator and cross-role interaction design

---

## Purpose

This document defines how operators across different roles and organizational tiers coordinate safely within the ClubHub TV platform. It governs the UX of shared operational authority, concurrent action visibility, conflict prevention, and operational communication.

The threat this document addresses: shadow operations. When operators lack visibility into what other operators are doing, they fill the gap with assumptions, tribal communication, and parallel interventions. The result is operational chaos dressed as coordination — multiple people working on the same problem in different directions, intervention collisions, and post-incident confusion about what happened and who did it.

**The governing principle: shared operational reality.** Every operator with a stake in a venue's operational state should be able to see, at any moment, what other operators are doing, what interventions are active, and who holds authority over what. Coordination should not require a phone call. It should be visible in the platform.

---

## Section 1 — Collaboration Philosophy

### 1.1 Shared Operational Reality

A "shared operational reality" is the condition where all operators involved in a venue's operation see the same operational state at the same moment. There is no private operational state — no action one operator can take that is invisible to other authorized operators.

This is not surveillance. It is operational coherence. An operator applying an override should expect that their supervisor and their colleagues can see the override, understand why it was applied, and act on it. An intervention that cannot be seen by authorized operators is an operational hazard.

**The shared reality principle governs:** Every operation-affecting action must be visible in the shared operational state within the platform's manifest polling cycle. There is no "private" override, no "temporary" intervention that escapes the operational record.

### 1.2 Authority Visibility

Authority visibility is the principle that every operator can see, for any operational context, who is authorized to act and what authority they hold. Authority should not be implicit or discoverable only through conflict.

An operator should never need to ask "am I allowed to do this?" — the platform should answer this question through UI affordances that are present only for authorized actions. An operator should never discover they lack authority for an action they need to take during an incident.

**Authority display requirements:**
- For any operational surface, the current operator's available actions should be visible without requiring them to attempt the action
- If a higher-authority operator is active in the same operational context, their presence and authority level should be visible
- When an action requires higher authority than the current operator holds, the platform should show who can authorize or perform the action — not just "you cannot do this"

### 1.3 Anti-Shadow-Operations Design

Shadow operations are interventions that happen outside the platform's operational record — verbal instructions to venue staff, informal overrides applied and not documented, configurations changed directly in the database. They are the primary mechanism through which operational state becomes unresolvable.

**Shadow operations emerge when:**
- The platform makes legitimate operations harder than the shadow alternative
- Operators don't trust that the platform reflects their intentions accurately
- The platform doesn't support the communication patterns the operation actually uses (e.g., no way to attach a note to an override explaining why it was applied)
- Role capabilities don't match operational reality (venue staff needing to act but not having access)

**Anti-shadow design principle:** The platform must be the path of least resistance for legitimate operations. Every shadow operation pattern that exists in the wild represents a platform design failure — the platform wasn't easier or more trustworthy than the workaround.

### 1.4 Coordination Over Autonomy

In operational systems, individual competence is not sufficient — coordination is what produces safe outcomes. An operator who takes excellent unilateral action during an incident, without notifying other operators, may resolve their piece of the problem while creating a coordination failure that produces a worse overall outcome.

**Coordination principle:** The platform should make coordination the default operational pattern, not an optional communication overhead. Actions that affect shared operational state should be visible to affected operators automatically, not only when the acting operator chooses to communicate.

---

## Section 2 — Role Interaction Models

### 2.1 Venue Operator ↔ Venue Operator

Multiple venue operators may work the same venue simultaneously, particularly during events. Their coordination needs:
- Real-time visibility into what the other operator is doing
- Clear ownership of specific operational concerns (one operator on content, one on sponsorship)
- Conflict prevention when both operators might act on the same condition

**Interaction model:** Peer coordination. Neither has authority over the other. The platform surfaces concurrent activity and flags potential conflicts; the operators resolve coordination verbally or through explicit claim/defer patterns.

**UX requirement:** When two operators are simultaneously active in the same venue's operational context, both should see a "co-operator active" indicator with the other operator's current focus area (e.g., "Alex — Override Management").

### 2.2 Venue Operator ↔ Venue Manager

The venue manager holds higher operational authority than venue operators. They may override operator decisions, take control of escalated incidents, and apply higher-scope interventions.

**Interaction model:** Authority hierarchy. The manager can see all operator activity. When the manager takes an action that affects something an operator is working on, the operator should be notified.

**UX requirement:** When a manager applies an intervention in an area where an operator has recently acted (within 30 minutes), the manager sees: "Operator [X] applied [action] to this context [Y min ago]." The manager's action is visible to the operator with the manager's identity and timestamp.

### 2.3 Venue Operator ↔ NOC / Network Operations

NOC operators monitor multiple venues and may take fleet-level or multi-venue actions. Their authority is typically wider in scope but shallower in venue-specific context than venue operators.

**Interaction model:** Parallel authority with scope differentiation. The NOC manages fleet-level conditions; venue operators manage venue-specific conditions. Both can take actions in overlapping areas — the platform must surface scope boundaries clearly.

**UX requirement:** When a NOC operator applies an action that affects a specific venue, venue operators at that venue see: "Network Operations applied [action] — scope: [scope] — reason: [operator-provided context]." NOC actions do not require venue operator confirmation, but they are never invisible to venue operators.

### 2.4 Venue Operator ↔ Sponsorship Team

Sponsorship team members operate in a parallel authority domain. They manage campaign delivery and SOV — which intersects with venue operators managing override stacks and schedule configurations.

**Interaction model:** Domain-adjacent coordination. The sponsorship team can request operational adjustments but may not unilaterally apply overrides without the appropriate authority level. When sponsorship requirements conflict with current override state, the conflict must surface to both teams.

**UX requirement:** SOV advisories visible to venue operators include a link to the sponsorship team contact responsible for the relevant campaign. Sponsorship team members can "annotate" an SOV condition with context ("client arriving in 30 minutes — please prioritize") that becomes visible to the venue operator's advisory panel.

### 2.5 Venue Operator ↔ Executive / Client

Executives and clients may have read access to operational state — often arriving at a venue, opening the platform on a phone, and viewing what's playing. They should not have live operational control, but their presence in the system should not be invisible.

**Interaction model:** Visibility-only presence. Executive/client users appear in the "who is watching" indicator in the venue view. Venue operators know when an executive or client is viewing their venue's state.

**UX requirement:** Executive presence should produce a subtle awareness indicator for venue operators: "Client view active." This is not a pressure signal — it is awareness. The operator chooses how to respond to that awareness.

### 2.6 Emergency Operator (during incidents)

During declared incidents, an emergency operator or incident commander holds elevated authority that supersedes normal role boundaries. Their actions take precedence; other operators' actions become advisory.

**Interaction model:** Command authority during incident scope. All operators active in the incident scope see the emergency operator's authority claim clearly. Other operators can continue to work but see their actions labeled "advisory — incident command active."

**UX requirement:** Incident command state must be unambiguous. The primary workspace for any venue under incident command shows: "[Name] holds incident command — [since time] — [authority scope]." All other operator actions in that scope are visible to the incident commander in a "parallel actions" feed.

---

## Section 3 — Shared Situational Awareness

### 3.1 Active Intervention Visibility

Every active override, emergency state, and configuration change should be visible to all authorized operators as part of the shared operational state. An intervention is not private to the operator who created it.

**Active intervention display:**
- Operator identity who created the intervention (name, not just role)
- Time of creation and (if set) expiry
- Stated reason or context (mandatory for Tier 3+ operations)
- Scope — what is affected
- Whether the intervention is still active, expired, or pending review

Operators who are looking at the same override stack should see the same information. There is no "personal" view of interventions.

### 3.2 Operator-Presence Awareness

Operators working in the same operational context should see who else is present. This includes:
- Who is actively in the venue's operational view right now
- What area they are focused on (override management, sponsorship, incident response)
- When they were last active (distinguishes active monitoring from a forgotten open tab)

**Presence display:** A "who is here" indicator in the venue workspace shows operator avatars (or initials) with their current focus area. Operators inactive for more than 5 minutes show a "last seen" time rather than an active focus indicator.

**Why this matters:** Knowing that another operator is also watching a condition produces different behavior than believing you're the only one watching. Shared presence visibility prevents both the "someone else will handle it" failure (diffusion of responsibility) and the "I need to fix this immediately because no one else knows" overreaction.

### 3.3 Concurrent Action Awareness

When two operators are simultaneously making changes to the same operational area, each should see that the other is in progress. The platform should not wait for a conflict to occur before surfacing concurrent activity.

**Concurrent action indicators:**
- "Another operator is modifying this override" (before any conflict exists)
- "Venue Manager is viewing incident detail for this screen" (while venue operator is also investigating)
- "Sponsorship team member is editing this campaign" (while venue operator is reviewing SOV)

These are awareness indicators, not blocks. The operators see each other's activity. They may choose to coordinate, defer, or proceed — but they make that choice consciously, not accidentally.

### 3.4 Intent Visibility

Intent visibility is the optional ability for operators to signal what they are planning to do before they do it. This supports advance coordination and reduces collision risk.

**Intent signal examples:**
- "I'm about to apply a venue-wide override for the sponsor event — 15 minutes"
- "Planning to clear all expired overrides after the event ends"
- "Reviewing sponsorship delivery before client arrival"

Intents are not commitments. They are coordination signals. Other operators can see the intent and coordinate accordingly — defer related actions, comment with context, or signal conflict.

**Intent display:** A "pending actions" section in the collaboration panel, visible to all operators in the context. Intents expire after 30 minutes if not acted upon.

### 3.5 Coordination Surfaces

A coordination surface is a designated place in the platform where operators communicate operational context without leaving the operational environment for external communication channels (text, phone).

**Coordination surfaces:**
- **Intervention notes:** Free-text field attached to any override, advisory acknowledgment, or escalation. Visible to all operators. Visible in postmortem.
- **Handover notes:** Structured notes for shift transition, separate from the auto-generated handover summary.
- **Incident log:** Append-only event log for incidents, where operators can add context entries visible to all participants.
- **Escalation context field:** When escalating an advisory or incident, a required context field: "What I've already tried / what I need from escalation."

These surfaces exist inside the platform because coordination that happens outside the platform is invisible to the operational record and to future operators who need to understand what happened.

---

## Section 4 — Conflict Prevention UX

### 4.1 Intervention Collision Detection

An intervention collision occurs when two operators apply interventions to the same scope that would conflict — two overrides that apply at the same level to the same screen, two emergency activations with conflicting content, two operators editing the same schedule block simultaneously.

**Pre-commit collision check:** Before any intervention is committed, the platform checks whether another intervention is in progress or recently committed to the same scope by a different operator. If yes:

- Show: "Operator [X] applied [action] to [scope] [Y min ago]. Your action will [effect of collision]."
- Options presented: "Proceed anyway" / "Review existing intervention first" / "Defer mine"
- Proceeding creates a conflict record showing both operators' actions and the resolution

This is not a block. The operator can proceed. But they cannot proceed accidentally.

### 4.2 Authority Overlap Visibility

When two operators both have authority over the same operational scope — a venue manager and a NOC operator, for example — and both are active, the overlap should be surfaced before any action is taken, not after a conflict.

**Authority overlap indicator:** When an operator is about to take an action in a scope where another operator with equivalent or higher authority is currently active, a brief awareness message surfaces: "Venue Manager is also active in this venue. Your actions will be visible to them."

This is purely informational. No confirmation required. The operator proceeds aware.

### 4.3 Escalation Ownership Clarity

During incident escalation, the moment when authority transfers from one operator to another is the highest-risk coordination point. Both parties may believe they are in control, or neither may believe they are in control.

**Escalation ownership transfer protocol:**
- Escalation creates an explicit ownership record: "Incident [X] escalated to [Name] at [time]."
- The receiving operator must explicitly accept the escalation before the transfer is complete
- Until acceptance, both operators see the incident as "pending transfer"
- After acceptance, the previous operator sees their authority as "advisory" in the incident scope
- If the escalation is rejected, it returns to the escalating operator with a reason

### 4.4 Duplicate Action Prevention

When the same action has already been taken, or is already in progress, the platform should surface this before the operator repeats it.

**Duplicate detection:**
- Override being applied to a scope that already has an equivalent active override: "A [type] override is already active on this scope. Creating another will [effect]. Continue?"
- Advisory being acknowledged that has already been acknowledged by another operator: "This advisory was acknowledged by [Name] [X min ago]. Mark as reviewed again?"
- Incident being escalated that is already in escalation queue: "This incident is already assigned to [Name] at [tier]."

Duplicates are surfaced as awareness, not blocks. The operator proceeds with full context.

---

## Section 5 — Communication Surfaces

### 5.1 Operational Annotations

Operators should be able to attach brief context notes to any operational object — an override, an advisory, a schedule block, a screen's current state. These notes are not free-form chat. They are operational context that becomes part of the object's provenance record.

**Annotation requirements:**
- Maximum 280 characters (context, not documentation)
- Visible to all authorized operators
- Timestamped and attributed
- Persists in the object's history even after the object is resolved/archived
- Visible in postmortem analysis and replay investigation

**What annotations are for:** "Why did you do this?" questions from future operators, postmortem reviewers, or handover recipients. An override with a note "Client requested all competitor content suppressed for their event 8pm–midnight" is self-explanatory to any future operator. An override without a note is an archaeological puzzle.

### 5.2 Replay-Linked Notes

Some operational context is most meaningful when linked to a specific operational moment — a decision made at 8:47 PM during an incident, a configuration change made in response to a sponsor call. Replay-linked notes attach the annotation to a point in the replay timeline.

**Replay-linked note use cases:**
- "This is when we realized the override was at wrong scope" — attached to the override creation timestamp
- "Sponsor called at this point, requested content boost" — attached to the time of the call
- "Emergency activated here — venue staff reported wrong content showing" — attached to emergency activation timestamp

These notes make the replay investigation surface significantly more useful, because future investigators can see not just what happened but what operators understood at each moment.

### 5.3 Incident Coordination Log

Active incidents should have a visible coordination log — a real-time, append-only record of significant events, operator actions, and coordination messages.

**Coordination log entries:**
- Automatic: state transitions, interventions applied, escalations, ownership transfers
- Manual: operator-added context entries ("Tried X, didn't work" / "Escalating because Y" / "Confirmed with venue staff that screens are showing Z")

The coordination log is the operational narrative of the incident. It should be readable as a timeline by any operator who joins the incident mid-response, and by any postmortem reviewer.

### 5.4 Sponsor Escalation Context

When sponsorship-related conditions trigger escalation (SOV risk, campaign delivery failure, contract threshold breach), the escalation must carry the business context that makes it actionable.

**Sponsor escalation context fields:**
- Contract tier (what was contracted, with whom)
- Current delivery status (what has been delivered vs contracted)
- Business context (client event tonight, renewal discussion in progress, etc.)
- Available remediation options (what can be done, with projected SOV impact)
- Who to contact for authorization if the remediation requires unusual authority

This context travels with the escalation so that the receiving operator can act without needing a separate briefing call.

### 5.5 Shift-Handover Messaging

In addition to the auto-generated handover summary, operators should be able to compose brief handover messages — personal operational context that the auto-summary doesn't capture.

**Handover message examples:**
- "The venue manager asked that we not change the sponsor rotation tonight — client is on-site."
- "The third screen in the main bar has been intermittently dropping out. It resolved itself each time but watch it."
- "Sponsorship team said they'll call at 10 PM with final instructions for the late slot."

These are the kind of operational intelligence that the incoming operator needs but that no automated system can generate. The handover message field should be prominent in the pre-departure checklist and in the incoming operator's shift briefing.

---

## Section 6 — Human Factors

### 6.1 Diffusion of Responsibility

Diffusion of responsibility is the tendency for individuals in a group to feel less personally responsible for an outcome when other people are present. In operational settings, it produces the "someone else will handle it" failure: an advisory that multiple operators can see but no one acts on because each assumes the others are aware and will respond.

**Design response:** Active assignments, not passive visibility. When an advisory or condition requires a response, it should be assigned to a specific operator or role — not just "visible to everyone." An unassigned condition with multiple operators aware of it is a diffusion-of-responsibility trap.

Where automatic assignment is not possible, operators should be able to "claim" a condition: "I'm handling this." The claim is visible to other operators and removes the ambiguity about who is responsible.

### 6.2 Authority Confusion

Authority confusion occurs when operators are uncertain about who has operational authority for a decision. It produces delay (everyone waiting for someone else to act), conflict (two operators each believing they have authority and taking contradictory actions), and blame displacement (post-incident dispute about who should have acted).

**Design response:** Authority must be explicit and visible, not assumed from role or convention. The platform should show, for any operational context, which operator currently holds the highest authority, what that authority covers, and how to escalate if higher authority is needed.

### 6.3 Hidden Local Workarounds

Local workarounds emerge when venue staff develop informal processes to manage operational conditions that the platform doesn't address well. These workarounds are invisible to the platform, to regional operators, and to postmortem analysis. When something goes wrong, the workaround is either the cause or the hidden context that makes the failure undebuggable.

**Design response:** The platform must be designed to make all legitimate operational needs expressible within it. When shadow workarounds are discovered (through postmortem, through operator interviews, through behavioral observation), they represent platform design gaps that must be addressed.

The platform should also make workaround documentation possible: "We're doing this manually because the platform doesn't support it yet" should be expressible as a flagged annotation, not just as informal knowledge.

### 6.4 Parallel Intervention Chaos

Parallel intervention chaos occurs when multiple operators take independent actions on the same operational condition simultaneously, without awareness of each other. Each action may be individually correct; the combination may be catastrophic.

**Design response:** Real-time concurrent action awareness (Section 3.3) and intent visibility (Section 3.4) are the primary design responses. Additionally, for high-risk action types (venue-wide overrides, emergency activation, scope-clearing operations), a brief "other operators are also active in this context" notification should surface before the action is confirmed — even if no active collision exists.

The notification is not a block. It is an invitation to a moment of coordination before an irreversible action.

---

*End of CROSS-ROLE-COLLABORATION-UX-v1.md v1.0*
*Authority: Agent 3. Role authority definitions and access control policy are Agent 2 domain.*
*Maintained by Agent 3 with Agent 2 review for any changes to role interaction models.*
