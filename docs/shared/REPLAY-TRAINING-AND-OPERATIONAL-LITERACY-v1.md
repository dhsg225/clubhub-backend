# ClubHub TV — Replay Training and Operational Literacy v1
# How Operators Learn Deterministic Operations

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, EXPLAINABILITY-UX-SPEC-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, SCREEN-INTROSPECTION-SYSTEM-v1.md, FAILURE-STORIES.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Operational Literacy Philosophy

---

### 1.1 Why Deterministic Systems Require Education

A deterministic system is more learnable than a non-deterministic one — given the same inputs, it always produces the same output. An operator who understands the inputs can predict the output. Understanding builds over time into reliable operational intuition.

But this potential is only realized if the operator can see the system's logic clearly enough to learn from it. A deterministic system that is opaque to its operators is no more predictable in practice than a random one — the operators cannot form accurate mental models because the system does not explain itself.

**The ClubHub TV system has the structural properties that make it highly learnable:**
- Constitutional determinism (INV-3): same inputs → same output, always
- Reason traces: every PRE decision is explainable
- Replay: any past state can be reconstructed

These properties are the raw material for an exceptional operator education system. The education system's job is to make these properties accessible to humans — to translate the system's deterministic logic into learnable operator mental models.

---

### 1.2 Why Operator Intuition Drifts

Even operators who start with correct mental models experience drift. Mental models formed from 6 months of correct operation decay through:

**Replacement:** New operators arrive with different training. They teach each other informal shortcuts. The correct model is gradually replaced by a simpler, less accurate one.

**Contextualization:** Operators build expectations from their specific venue's typical state. A venue that has always had many overrides will produce operators who believe many overrides is normal. A venue where emergencies are used routinely will produce operators who believe emergencies are routine.

**Attrition:** Per OPERATIONAL-INSIGHTS-LOG.md INSIGHT-008, high-competency operators leave. The operators who remain were trained by those who left — but training quality degrades with each handoff. Mental models degrade through the chain.

**Drift is not failure — it is normal.** The response is not to prevent drift (impossible) but to design systems that detect drift and correct it: refresher training triggers, operational literacy indicators, and a learning system that is always accessible.

---

### 1.3 Why Replay Is Superior to Static Training

Traditional training teaches operators how the system should work by showing them documentation and examples. Replay-based training teaches operators how the system actually worked in their actual venue, with their actual configurations.

**The difference is enormous:**

Static training: "In this scenario, an override suppresses the campaign because LEVEL_1 takes precedence over LEVEL_3."

Replay-based training: "On March 15th at your venue, the override [OPERATOR_A] created for the tournament was still active 30 days later. This is why Campaign B wasn't showing on screens B1 and B2. Here is the full resolution trace showing exactly what happened."

Replay-based training:
- Uses real events from the operator's actual context
- Demonstrates consequences the operator has actually experienced
- Connects abstract system concepts to concrete operational outcomes
- Cannot be dismissed as hypothetical ("that wouldn't happen here" — it already did)
- Produces durable learning because the memory is episodic, not conceptual

---

## Part 2 — Training Tiers

---

### 2.1 Novice Operators

**Profile:** New to the CMS, often new to the venue. May have general operations experience; does not have ClubHub-specific system understanding.

**Learning objectives:**
1. Understand that content scheduling has a priority hierarchy — not all changes are equal
2. Know how to create an override and understand that it temporarily displaces other content
3. Know how to check what is currently playing on a screen and why
4. Know when to escalate to a Venue Manager rather than acting independently

**Training sequence:**
1. Orientation (30 min): What the screens show, why it matters, what the operator's role is
2. Screen inspection practice (15 min): Open any screen, read the current state, identify the winning rule
3. Override creation simulation (20 min): Create an override in a sandbox, observe its effect on timeline and other rules, clear it
4. Escalation drill (10 min): Identify scenarios that require Venue Manager escalation vs. independent action

**What novice operators do NOT need in initial training:**
- Resolution level taxonomy in full detail
- Entropy metrics
- Sponsor SOV management
- Emergency tool usage

These are introduced progressively as the operator gains experience.

---

### 2.2 Venue Managers

**Profile:** Accountable for venue operational health. Manages other operators. Has sponsor relationships and compliance obligations.

**Learning objectives:**
1. Understand the full resolution hierarchy and predict what will play given any configuration
2. Understand entropy signals and how to read the venue health grade
3. Understand override governance — when overrides are appropriate and how to clean them up
4. Understand sponsorship SOV tracking and suppression diagnosis
5. Understand the incident management workflow

**Training sequence:**
1. Resolution model walkthrough (45 min): Work through the 7-level hierarchy with real examples from their venue's history
2. Entropy diagnosis (30 min): Review the venue's actual override history; identify stale overrides; practice cleanup workflow
3. Sponsor management (30 min): Walk through the SOV dashboard; identify a suppressor; simulate a sponsor SOV recovery
4. Incident simulation (45 min): A scripted incident scenario played through the replay system; practice detection, diagnosis, intervention, and postmortem

**Replay-based component:** The venue's actual operational history is used in training. If the venue has had a sponsorship conflict, a stale override problem, or an emergency that persisted — these are the training scenarios, not hypothetical examples.

---

### 2.3 Sponsorship Staff

**Profile:** Manages sponsor relationships. Accountable for SOV delivery. May have limited operations background.

**Learning objectives:**
1. Understand that sponsor content operates at LEVEL_4 and can be suppressed by higher-level content
2. Know how to read the SOV dashboard and identify suppression
3. Know how to diagnose a suppressor and escalate to a Venue Manager to resolve it
4. Know how to generate a proof-of-play report

**Training sequence:**
1. Resolution reality for sponsors (20 min): Plain-language explanation of why sponsor content can be suppressed, with examples
2. SOV dashboard practice (20 min): Read the current SOV status, identify any shortfalls, identify the suppressor
3. Proof-of-play report generation (15 min): Generate a sample report; understand the three-tier methodology (contracted / configured / confirmed)
4. Escalation practice (15 min): Use the suppression visibility surface to create an escalation request to the Venue Manager

---

### 2.4 Emergency Operators

**Profile:** Any operator who has emergency activation authority. Typically Venue Managers and above.

**Learning objectives:**
1. Know the emergency activation flow — by memory, without needing to navigate (emergencies happen under stress)
2. Understand that emergency content persists until manually cleared
3. Know the appropriate scope for different emergency types
4. Know the emergency clearance flow — including verifying that screens have returned to normal

**Training sequence:**
1. Emergency activation walkthrough (20 min): Walk through the activation flow step by step; understand each decision point
2. Scope calibration (15 min): Practice selecting the minimum necessary scope for different emergency scenarios
3. Emergency clearance drill (15 min): Activate a sandbox emergency; wait; clear it; verify recovery
4. Semantic drift awareness (20 min): Review examples of emergency semantic collapse; practice identifying non-emergency urgency and using appropriate override tools instead

**Critical outcome:** Emergency operators must be able to activate and clear emergencies correctly under stress. This is assessed through a timed simulation drill — the operator must complete the activation flow correctly in under 90 seconds.

---

### 2.5 Network Operations Operators

**Profile:** Manages a fleet of venues. Sees patterns across multiple venues. Has authority for org-level interventions.

**Learning objectives:**
1. Understand the fleet health dashboard and how to prioritize which venues need attention
2. Know how to drill from fleet view to venue-level detail to screen-level detail
3. Understand how to identify systemic patterns (vs individual venue issues)
4. Know how to initiate a venue health intervention (structured cleanup engagement)

**Training sequence:**
1. Fleet dashboard orientation (30 min): Navigate the fleet view; filter by grade; identify the most critical venue
2. Venue health investigation (30 min): Drill into a degraded venue; follow the entropy signal to root cause; propose intervention
3. Pattern recognition (30 min): Review multiple venues; identify a systemic pattern; distinguish it from individual venue variation
4. Cross-venue intervention (20 min): Practice creating a cross-venue configuration change with per-venue impact review

---

### 2.6 Executive Operational Literacy

**Profile:** Does not manage operations directly. Needs to understand operational health for business decisions (sponsor negotiations, resource allocation, expansion decisions).

**Learning objectives:**
1. Understand what the health grades mean in business terms
2. Know how to interpret a venue health trend
3. Know what questions to ask when health is degrading ("which venues, what's the root cause?")
4. Know that the system is deterministic and explainable — not magic or mysterious

**Training sequence:**
1. Business translation session (45 min): Review the executive oversight workspace with a guided walkthrough; every metric translated to business impact
2. No technical depth required — this is a comprehension training, not a capability training

---

## Part 3 — Replay-Based Education

---

### 3.1 Historical Incident Replay

The single most powerful educational tool in the ClubHub TV platform is its own operational history.

**Replay education protocol:**

1. Identify a real incident from the venue's history that illustrates the learning objective
2. Open the incident timeline in the training context
3. Step through the timeline with guided annotations — "what happened here?" "why did the screen change?" "what would have prevented this?"
4. Reach the intervention point — "what did the operator do? Was it the right action? Was there a faster path?"
5. Reach the recovery point — "how long did recovery take? Could it have been faster?"

**Training scenarios linked to FAILURE-STORIES.md:**

| Failure story | Training objective | Learning outcome |
|--------------|-------------------|-----------------|
| Story 1 (Campaign That Wasn't Showing) | Suppression visibility | Operators learn to check for active overrides before assuming campaign is broken |
| Story 2 (Emergency That Wasn't) | Emergency clearance | Operators learn to set expiry dates and monitor emergency duration |
| Story 3 (Stale Golf Club) | Off-boarding and knowledge transfer | Venue Managers learn to document and review configurations before operators leave |
| Story 4 (Priority Wars) | Resolution model | Operators learn that content priority ≠ resolution level |
| Story 5 (Sponsor Who Owned the Screen) | Sponsor SOV management | Sponsorship staff learn to check saturation |
| Story 7 (Preview That Lied) | Preview trust | Operators learn that preview accuracy depends on stable state |

Each failure story is an educational asset. The system should support a "training mode" in which operators can step through a historical incident, make decisions at key junctures, and see how the scenario unfolds.

---

### 3.2 Counterfactual Training

Counterfactual training asks: "What would have happened if a different decision was made?"

Using the PRE's deterministic replay, counterfactual training can simulate:

- "If Override_004 had been created with a 7-day expiry instead of no expiry, how would that have changed the outcome?"
- "If the operator had checked the suppression tree before creating a new override, what would they have found?"
- "If the SOV alert threshold had been set at 22% instead of 20%, would this incident have been detected earlier?"

Counterfactual training is uniquely powerful because it is grounded in actual events. The operator is not reasoning about a hypothetical — they are reasoning about something that actually happened at their venue, with a specific alternative path.

**Training format:**

```
Counterfactual Training — Override_004 Incident

What happened:
  Override_004 created with no expiry on 2026-04-04
  Sponsor SOV declined to 19%
  Detected 58 days later when SOV alert triggered
  Total sponsor shortfall: ~87 hours

Now explore: What if Override_004 had a 7-day expiry?

  → Override_004 expires 2026-04-11 (7 days after creation)
  → Campaign A resumes on B1–B2 on 2026-04-11
  → Sponsor SOV returns to 24% within 2 weeks
  → Total sponsor shortfall: ~8 hours

Learning: A 7-day expiry on Override_004 would have reduced the
sponsor shortfall by 90%. The default expiry policy matters.
```

---

### 3.3 "Why This Happened" Exercises

Root cause analysis exercises walk operators through the full causal chain from initial configuration state to incident outcome:

```
Exercise: Why did [SPONSOR_X]'s content stop showing?

Step 1: What was the screen showing when the incident was reported?
  → Open screen introspection for 2026-06-02 14:00
  → B1 is showing [CONTENT_B] via Override_004 at LEVEL_1

Step 2: When was Override_004 created?
  → Override_004 created 2026-04-04 by [OPERATOR_A]
  → Created for: Tournament day sponsor content
  → Expiry: none set

Step 3: What happened to sponsor content during this period?
  → [SPONSOR_X] LEVEL_4 injection suppressed by Override_004 on B1–B2
  → SOV declined from 25% to 19% starting 2026-04-04

Step 4: What is the root cause?
  → Override_004 created without expiry
  → No cleanup workflow identified it as stale after the tournament

Step 5: What would have prevented this?
  → Mandatory expiry on all non-permanent overrides
  → Stale override detection (overrides with reason field referencing past events)
  → SOV monitoring with lower alert threshold
```

These exercises are designed for Venue Manager training — they build the diagnostic skills that allow Venue Managers to investigate incidents independently.

---

### 3.4 Override Consequence Education

A specific training module on the consequences of different override decisions — the educational counterpart to the operational debt framing (INTERVENTION-AND-OVERRIDE-UX-v1.md §1.1).

**Module: The cost of no expiry**

Show the operator the override aging distribution for their own venue (or a sample venue if they are new). Walk through each override in the 30+ days category:

```
This override has been active for 47 days with no expiry.

During this time:
  → Suppressed Campaign A on B1–B2 for 47 days
  → Reduced [SPONSOR_X] SOV by approximately 3% per day
  → Generated entropy signal: Tier 2 advisory for 17 days

What it would have taken to prevent this:
  → Setting a 7-day expiry at creation time
  → One additional field in the override creation form
```

The module quantifies the cost in terms the operator cares about — sponsor hours, health grade impact, detection delays. Abstract entropy metrics become concrete operational costs.

---

### 3.5 Sponsor Suppression Education

A specific training module for understanding LEVEL_4 suppression — designed for both operators who create overrides and sponsorship staff who manage SOV.

**Module: Why your sponsor content disappeared**

A guided walkthrough of a sponsor suppression event, with the full resolution trace visible:

```
At 14:00 on 2026-05-20, [SPONSOR_X] content was not playing on B1.

Here is what the PRE computed:

LEVEL_0: No emergency [PASS]
LEVEL_1: Override_004 active ← WINNER
  Override_004 is showing [CONTENT_B]
LEVEL_2: Not evaluated
LEVEL_3: Not evaluated
LEVEL_4: [SPONSOR_X] injection ← SUPPRESSED (never reached)

The PRE evaluated LEVEL_1 before LEVEL_4.
Override_004 at LEVEL_1 won. Sponsor content at LEVEL_4 was never considered.

This is expected behavior — not a bug.

What can cause sponsor content to be suppressed:
  → Any LEVEL_1 Operational Override on these screens
  → Any LEVEL_2 Scheduled Override on these screens
  → Any LEVEL_3 Campaign with higher specificity on these screens

How to check for active suppressors:
  → Open Sponsorship Operations Workspace
  → Select [SPONSOR_X]
  → View "Active suppressors" panel
```

This module eliminates the "the system is broken" interpretation that sponsorship staff commonly apply to LEVEL_4 suppression.

---

## Part 4 — Safe Sandbox UX

---

### 4.1 Simulation Environment

Every venue should have access to a simulation environment — a non-production replica that allows operators to experiment freely without affecting live screens.

**Sandbox properties:**
- Uses actual venue configuration as starting state (copied at simulation launch time)
- All CMS actions work normally — overrides are created, campaigns are modified, emergencies are activated
- No changes affect live screen delivery (devices do not receive sandbox manifests)
- The PRE is called against sandbox state — resolution traces, previews, and reason traces are fully accurate
- PRE output and manifests computed for sandbox are labeled with "SANDBOX" on all surfaces

**Use cases:**
- New operator onboarding: practice all CMS actions without risk
- Emergency drill: practice emergency activation and clearance in a live-like environment
- Configuration testing: test a proposed configuration change before deploying to live
- Training exercises: run replay-based exercises in an interactive environment

---

### 4.2 Non-Production Experimentation

The sandbox is not the only safe experimentation tool. Preview mode (PREVIEW-SYSTEMS-SPEC-v1.md) provides read-only exploration of future states without creating any configuration objects.

**Recommendation for operators:** "When you want to understand how the system would respond to a change, use Preview first. If Preview confirms the desired outcome, make the change in live. If you're uncertain about the change's scope or complexity, test it in the Sandbox first."

The educational progression: Preview (read-only exploration) → Sandbox (full-action simulation) → Live (production change).

---

### 4.3 Preview-Only Operations

For operators who do not yet have full configuration authority (new Floor Operators, operators in probation periods, external consultants), the CMS supports a "preview-only" mode where all CMS navigation and inspection tools are available but no configuration changes can be committed.

**Preview-only mode capabilities:**
- Full screen introspection (current state, resolution traces, suppression trees)
- Full timeline navigation (all seven temporal horizons)
- Full preview simulation (what-if scenarios)
- Full replay access (historical reconstruction)

**Preview-only mode restrictions:**
- Cannot create, modify, or delete any configuration objects
- Cannot activate emergency content
- All proposed changes enter an "approval queue" rather than taking immediate effect

Preview-only mode is the default for new operators in the first week of access. It provides a safe learning environment while still giving operators the full diagnostic toolkit.

---

### 4.4 Intervention Rehearsal

For operators who will be responsible for incident response (Venue Managers, NOC operators), intervention rehearsal is a specific simulation mode:

**Rehearsal scenario library:**

Pre-built scenarios that operators can run through in the sandbox:
1. "Campaign not showing — diagnose and fix a LEVEL_1 suppressor"
2. "Sponsor SOV shortfall — identify and resolve the suppressor"
3. "Emergency content active for 3 days — identify and clear it"
4. "Override cascade during event night — identify conflict and coordinate resolution"
5. "Screen offline — diagnose and confirm recovery"

Each scenario has a defined starting state (loaded into the sandbox), a problem to solve, and a success criterion. Operators work through the scenario using the full CMS toolkit. The scenario engine tracks the path they took and identifies whether they took the most efficient route or a less efficient one.

---

## Part 5 — Operational Certification Models

---

### 5.1 Emergency Privileges

Emergency content activation is a high-authority, high-consequence capability. Granting it requires demonstrated competency.

**Certification requirements for emergency authority:**
1. Completed emergency operator training (Part 2.4)
2. Passed timed emergency activation drill: activate and clear a sandbox emergency correctly in under 90 seconds
3. Demonstrated understanding of scope minimization: correctly identified minimum scope for 3 test scenarios
4. Acknowledged emergency semantic drift awareness: knows the difference between emergency and urgency

**Ongoing requirement:** Emergency re-certification annually. Operators who have not used the emergency system in 6+ months should complete a refresher drill before their next certification renewal.

---

### 5.2 Override Privileges

Standard override creation is available to all operators. Elevated override privileges (higher scope, longer duration, no expiry) are certification-gated:

| Privilege level | Scope | Max duration | Certification requirement |
|-----------------|-------|-------------|--------------------------|
| Basic | Screen or zone only | 7 days | Default — all operators |
| Standard | Venue-wide | 30 days | Floor Operator training complete |
| Advanced | Multi-venue | Unlimited | Venue Manager training complete |
| Governance | Org-wide | Unlimited | Org Admin only |

**Rationale:** Scope constraints for uncertified operators prevent the most consequential entropy patterns. A new Floor Operator who creates an override can affect at most one zone for at most 7 days. The entropy impact of this is bounded.

---

### 5.3 Sponsor Intervention Authority

Direct sponsor content modifications (changing SOV, modifying LEVEL_4 injection scope, creating sponsor-specific overrides) require demonstrated understanding of sponsor contract implications:

**Certification requirements:**
1. Completed sponsorship staff training (Part 2.3)
2. Demonstrated ability to read and interpret the SOV dashboard
3. Acknowledged that SOV modifications may affect contract obligations

---

### 5.4 Replay Audit Authority

Historical replay of other operators' actions is a sensitive capability. While the data is factual and operational, access to other operators' historical actions requires appropriate authority:

| Replay scope | Authority required |
|-------------|-------------------|
| Own actions only | All operators |
| Any action at this venue | Venue Manager |
| Any action at any venue | Org Admin |
| Cross-venue incident replay | NOC or Org Admin |

Replay audit access is logged — the system records when any operator accesses historical replay data for which operators' actions, and when.

---

## Part 6 — Trust-Building Education

---

### 6.1 How Operators Learn Predictability

Trust in the ClubHub system is built through the prediction-verification cycle (OPERATOR-COGNITIVE-MODELS-v1.md §7.1). Education accelerates this cycle by:

1. **Teaching the prediction model explicitly:** Operators who understand the resolution hierarchy can make accurate predictions from day one, rather than discovering the rules through repeated experimentation.

2. **Providing low-stakes verification opportunities:** The sandbox and preview system give operators the ability to make predictions and verify them without operational risk. Each successful prediction builds the mental model.

3. **Making incorrect predictions educational rather than punitive:** When an operator makes a prediction (via preview) and the actual outcome differs, the reason trace explains why the prediction was wrong. The operator learns the specific mental model gap that caused the prediction error.

---

### 6.2 How Trust Becomes Stable

Operator trust becomes stable when the operator's mental model is sufficiently accurate that prediction failures become rare. At this point, the operator no longer needs to verify every change through preview — they have enough confidence in their understanding to make changes directly.

**Stable trust indicators:**
- Operator uses preview for complex or edge-case changes, not routine ones
- Operator can read a resolution trace and identify the root cause of a suppression without guidance
- Operator correctly identifies the cleanup action needed for a stale override without prompting
- Operator's override count is low and override ages are consistently short

Stable trust is the goal of operational education. It is not achieved through training completion — it is achieved through accumulated correct predictions over real operational experience.

---

### 6.3 How Replay Eliminates Folklore

OPERATOR-COGNITIVE-MODELS-v1.md §6.2 documents how folklore about system behavior forms and spreads. Replay is the structural counter to folklore because it provides authoritative explanation for any observed outcome.

**Folklore elimination pattern:**

Folklore: "You need to set priority to maximum or your content won't show."

Replay response: "Let's look at the resolution trace for the last time you saw content not showing. [Opens replay] — The reason it wasn't showing was this operational override at LEVEL_1. Content priority would have had no effect on this. Here is why: [resolution trace explains SWRR weight vs resolution level distinction]."

The operator who experiences this explanation learns two things:
1. The specific correct explanation for the incident they remember
2. That the system can explain itself — folklore is not necessary

Over time, operators who have access to replay and who have experienced it correctly explaining real incidents stop generating and accepting folklore. The explanation is always available; guessing is unnecessary.

---

## Part 7 — Long-Term Drift Prevention

---

### 7.1 Refresher Learning Triggers

Mental model drift is inevitable without periodic refresher intervention. The CMS should trigger refresher learning prompts based on operator behavior signals:

| Behavior signal | Possible drift indicated | Refresher prompt |
|----------------|------------------------|-----------------|
| Override count increasing over time | Override addiction pattern | "You have created N overrides this month. Would you like to review when campaigns are a better fit?" |
| Multiple overrides created without expiry in a week | Expiry awareness drift | "3 recent overrides have no expiry date. [Set expiry dates] or [Review why expiry matters]" |
| Priority escalation pattern detected | Priority-as-number fallacy | "You've increased content priority on several items. [Learn how content priority works]" |
| No login for 30 days then active | Re-onboarding needed | Brief "what has changed since you were last active" summary |
| Emergency activated with non-emergency reason text | Semantic drift | "[OPERATOR]: This emergency has a reason that sounds operational, not safety-related. [Learn the difference] [Emergency tools for operations]" |

These prompts are gentle — they offer learning, not discipline. They appear once per signal pattern, not repeatedly.

---

### 7.2 Operational Drift Detection

At the venue level, a "training health" indicator can surface whether a venue's operator population shows signs of mental model drift:

**Training health signals:**
- Average override age increasing → possible expiry awareness drift
- Override count increasing without cleanup → possible override addiction drift
- Priority range widening → possible priority misconception drift
- Campaign adoption rate declining (more shadow scheduling) → possible resolution model drift

**Training health indicator in the Venue Operations Workspace:**

```
Training Health — [VENUE_NAME]

  Operator training status:
  [OPERATOR_A] — Floor Operator training: ✓ Complete (2026-01-15)
  [OPERATOR_B] — Floor Operator training: ✓ Complete (2026-02-20)
  [OPERATOR_C] — Floor Operator training: ⚡ Overdue for refresher (last trained 2025-11-01)

  Behavioral drift signals:
  ⚡ Override addiction pattern: override count increased 40% this quarter
  ⚡ Expiry awareness: 4 overrides created without expiry this month

  Recommended: Schedule override governance refresher for [OPERATOR_A], [OPERATOR_B]
```

---

### 7.3 Evolving Mental-Model Correction

As the ClubHub TV platform evolves — new features, new resolution levels, new entropy patterns — operator mental models must evolve with it. A feature that changes resolution behavior requires operators who have already learned the old behavior to update their mental model.

**Change notification for operators:**

When a system update changes behavior that operators have learned, a targeted update message is shown to relevant operators:

```
System update: Override expiry behavior changed

Previously: Overrides with no expiry date were treated as indefinite.
Now: Overrides with no expiry date generate a monthly review reminder.

What this means for you:
→ Your existing no-expiry overrides will generate review reminders
→ New overrides still accept no-expiry but will prompt you monthly

[Review your active no-expiry overrides] [Learn more]
```

This is not a changelog — it is a targeted mental model update, framed in terms of what the operator knew before and what they need to update.

---

*End of REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Sandbox environment: Agent 1 (Platform) implementation requirement*
*Training completion tracking: Agent 2 (CMS) data model requirement*
*Certification gating: Agent 2 (CMS) authority model requirement*
