# High-Trust Workflows

**Version:** 1.0
**Status:** Authoritative
**Scope:** Workflows that must build and maintain operator trust in the constitutional media system
**Related:** OPERATOR-MENTAL-LOAD.md, LOW-CONFIDENCE-STATE-HANDLING.md, RECOVERY-ORIENTED-DESIGN.md

---

## Trust Premise

Operators trust systems that do what they say and say what they are doing.

Trust is not built through marketing, training, or documentation. It is built through repeated, accurate confirmation that the system's stated behavior matches its actual behavior. Every time the system says "content X will play at time Y" and content X plays at time Y, a deposit is made to the trust account. Every time it does not, a withdrawal is made. Withdrawals are larger than deposits — one broken promise costs more trust than ten kept ones earn.

The workflows in this document are the highest-trust touchpoints in the platform. They are the moments where the system makes a specific, verifiable promise to the operator. The implementation requirements here are not optional enhancements — they are requirements for the platform to function as a reliable operational tool.

---

## 1. Preview Trust

**Principle:** What the operator sees in preview is what plays on screen. Not approximately. Not usually. Always.

### Why This Is a Trust-Critical Workflow

Preview is the operator's primary tool for verifying their intent before committing to a change. If preview shows content A and the screen plays content B, the operator has lost their ability to verify anything before publishing. The preview becomes theater — it looks like verification but provides none. Once operators learn that preview is unreliable, they stop trusting it, which means they stop catching mistakes before they go live.

### Requirements

**Same resolution path:** Preview must use the identical PRE.resolve() path as live playback. It must receive the same corpus version, the same resolution logic, the same level hierarchy (LEVEL_0 through LEVEL_6). A preview that shortcuts the resolution path — using a simplified engine, a cached result, or a different corpus snapshot — is not a preview of what will play.

**Same corpus version:** The preview operates on the corpus version that will be active at the preview time. If the operator is previewing tomorrow at 19:00, the preview engine uses the corpus version that will be active tomorrow at 19:00. If that corpus version has not yet been finalized (pending campaign awaiting approval), the preview must indicate that the final result may change and specify what is pending.

**Preview confidence labeling:** Every preview result carries a confidence label:
- **STABLE**: all inputs to this resolution are finalized; this result will match playback unless a mutation occurs before that time
- **CONDITIONAL**: result depends on a pending approval or pending content upload; preview shows the expected result if approvals succeed
- **UNCERTAIN**: one or more resolution inputs are unavailable or in a degraded state; result may not match playback
- **LOW**: corpus or schedule data is sufficiently uncertain that the preview should not be used as a verification tool; operator must be told why

Operators must never receive a preview result without knowing its confidence level.

**Deviation detection:** If PRE.resolve() produces a result during preview that differs from the result at playback time, this deviation must be detected and surfaced. The forensic audit trail provides the mechanism: the preview's resolution hash and the live resolution hash can be compared. Any divergence must generate a HIGH alert.

**Preview is not a simulation:** Preview must not use approximated or estimated content. It uses the same real data that the live system would use. If data is unavailable (e.g., a screen is offline and its current state is unknown), this limitation is disclosed — not silently substituted.

### Trust-Breaking Anti-Pattern

An operator previews their campaign for Saturday evening. The preview shows the promotional video running correctly. On Saturday evening, the emergency override from Friday night is still active (it was set to expire at midnight but was extended and the operator was not notified). The screens play emergency content. The preview was correct — it was a perfect preview of what would have played without the emergency. But the operator experienced a preview that "lied."

This is not a preview failure — it is an override management failure. But operators will attribute it to preview unreliability. The system must surface active overrides as part of preview context: "This preview assumes no active overrides. Currently active overrides: [list]. If these remain active at preview time, they will take precedence."

---

## 2. Publish Confirmation

**Principle:** Publishing a campaign or content change must produce a clear, specific diff that shows exactly what changes, when, on which screens, and what is being replaced.

### Why This Is a Trust-Critical Workflow

"Are you sure you want to publish?" is not a confirmation. It is an opt-out prompt that operators click through because they have already decided to publish. Real confirmation gives operators information they did not have before — specifically, the concrete operational impact of what they are about to do.

### Requirements

**Change summary before commit:** Before an operator confirms a publish action, they see:
- Which screens are affected (by name, not by count — "Bar Area Display, Entrance Display" not "2 screens")
- What content is being added, removed, or changed (content names, not IDs)
- When the change takes effect (specific datetime, not "immediately" unless it is literally immediate)
- What is currently playing on those screens and what will replace it (before/after comparison)
- Whether the change affects any compliance content slots (if yes, flagged prominently)

**No "processing" confirmation:** The system must not confirm a publish with "Your changes are being processed." This tells the operator nothing. The confirmation must state the completed effect: "Campaign 'Summer Specials' is now active on 3 screens starting at 18:00 today. Previous content 'Happy Hour v2' has been replaced."

If the system cannot confirm immediately (e.g., due to network propagation delay to screens), it must give a specific expected confirmation time: "Changes will propagate to screens within 90 seconds. You will receive confirmation when all screens have acknowledged."

**Failed propagation handling:** If a screen does not acknowledge the content change within the expected propagation window, the operator sees: "Screen 'Patio Display' has not confirmed the content update. Last contact: [time]. This screen may still be showing the previous content." This is not an error — it is accurate status reporting.

**Audit trail:** Every publish action creates an immutable audit record: who published, what changed, at what time, which corpus version was in effect. This record is accessible from the screen introspection view.

---

## 3. Emergency Trigger Confidence

**Principle:** When an operator triggers an emergency override, they must receive immediate, unambiguous confirmation that the emergency is active and visible evidence of what is now playing.

### Why This Is a Trust-Critical Workflow

Triggering an emergency override is the highest-urgency action a venue operator takes. They do it in response to a time-critical situation — a safety incident, a compliance requirement, or an unexpected event. If they trigger the emergency and do not know whether it worked, they either trigger it again (causing a conflict) or wait anxiously while potentially harmful content remains on screen.

The emergency trigger confirmation is the moment where the system must be absolutely reliable in its feedback.

### Requirements

**Immediate visual confirmation:** Within 5 seconds of triggering the emergency, the operator sees:
- "Emergency active" status indicator (persistent, prominently colored — not a toast notification that disappears)
- Which screens have confirmed the emergency content (updated as screens acknowledge)
- Which screens have not yet confirmed (pending propagation)
- What content is now playing on confirmed screens

If the emergency content fails to propagate to any screen within the expected window, this is surfaced immediately — not silently.

**Scope confirmation:** The operator sees the exact scope of the emergency before confirming it. For a venue-wide emergency: "This will affect all 8 screens at [venue name]. Emergency content '[content name]' will play immediately, overriding all scheduled and campaign content." The operator confirms with full knowledge of scope.

**Emergency content preview:** Before triggering, the operator can preview what the emergency content looks like. In a genuine emergency, they may not preview — but the option must be there.

**Persistent status:** The active emergency indicator must remain visible throughout the operator session until the emergency is cleared. It must not be dismissable. It must not disappear after the operator navigates away. If a new operator logs in while an emergency is active, they see the emergency status immediately.

**Clearing the emergency:** When the operator clears the emergency, they see: "Emergency cleared at [time]. Screens are returning to scheduled content." If any screen fails to return to normal operation, this is flagged: "Screen 'Bar Area Display' has not confirmed emergency clearance."

---

## 4. Override Confirmation

**Principle:** When an override is created, the operator sees the complete operational picture: effective scope, time boundaries, content, and expiry — at creation and proactively before expiry.

### Requirements

**Creation confirmation:** On creating an override, the operator sees:
- Effective start time (exact datetime)
- Expiry time (exact datetime, prominently labeled)
- Which screens are in scope
- What content plays during the override period
- What content the override is replacing (previous/current content for those screens during that window)
- Whether the override conflicts with any compliance content slots

**Expiry visibility:** Override expiry time is always visible in the active override list. Overrides expiring within 8 hours are highlighted. Overrides expiring within 30 minutes are elevated to MEDIUM alert status.

**Expiry warning:** 30 minutes before an override expires, the operator (or on-call operator if primary is not active) receives an explicit notification: "Override '[name]' expires in 30 minutes at [time]. Screens will return to [scheduled content]. No action needed if intended."

This notification explicitly says "no action needed if intended" — this reduces the panic response. The operator knows the system is telling them about an approaching expiry, not about a failure.

**Unintended expiry recovery:** If an override expires and the operator believes it should still be active, the audit log shows the exact expiry event. The operator can view what played after expiry (via audit) and create a new override if needed. Recovery from unintended expiry must not require technical support — the operator has all the tools.

---

## 5. Entropy Report Credibility

**Principle:** Entropy reports must be interpretable by operators without technical expertise. They must explain what was expected, what was found, how long the drift has existed, and what the practical impact is on playback.

### Why This Is a Trust-Critical Workflow

An entropy report that operators cannot interpret becomes a prompt for random action or no action. If the report shows "drift_score: 0.73, affected_items: 47, severity: WARNING" without translation, the operator cannot evaluate whether this is an emergency, a routine observation, or a false alarm. They either over-react (triggering unnecessary escalation) or under-react (ignoring something meaningful).

An entropy report that is credible and readable builds trust in the entropy monitoring system. Operators who understand what entropy means can be accurate judges of when to acknowledge it as expected and when to escalate it as a problem.

### Requirements

**Plain-language summary:** Every entropy report opens with a plain-language summary:

> "The scheduled content for [screen type] on [date] did not match the expected content for [N] of [M] items. [N] items were missing and [N] items were different from expected. This drift has been present for [duration]. The impact is: [screens affected] are serving [fallback/alternative content] during the affected periods."

**Expected vs. found comparison:** The report shows a side-by-side comparison: what the schedule specified vs. what was actually resolved. Not statistics — specific content names and time windows.

**Drift age:** How long has this drift been present? "First detected: 3 hours ago" vs. "First detected: 6 days ago" requires different urgency responses.

**Practical impact:** Does this drift affect what plays on screens right now? Is it affecting compliance content? Is it in a period that has already passed (historical) or a period that is coming up? Impact on future content windows is more urgent than impact on past windows.

**Acknowledgment options:** The operator can:
- Acknowledge as expected (with a note explaining why): logged audit record, notification suppressed
- Acknowledge with investigation intent: creates a tracked follow-up item
- Escalate: sends to REGIONAL_MANAGER feed with the entropy context attached

Every acknowledgment is logged. Operators cannot silently dismiss entropy reports.

---

## 6. Canary Status Transparency

**Principle:** Operators eligible to approve canary promotion see the complete parity picture, not a binary ready/not-ready verdict. The data supports their decision — the system does not make the decision for them.

### Why This Is a Trust-Critical Workflow

Human approval at every canary stage is a constitutional requirement. The value of that approval depends entirely on the quality of information the approving operator has access to. An approval made with insufficient context is effectively an automated approval wearing a human mask.

The canary status display must make the operator genuinely informed before they approve. If an operator approves a canary promotion without understanding what parity means and whether the current parity is acceptable, the human approval gate has failed its purpose.

### Requirements

**Complete information, single view:** On the canary status / promotion approval screen, the operator sees:

- Current stage (e.g., SINGLE_VENUE) and proposed next stage (e.g., MULTI_VENUE)
- Parity ratio: current value, with sparkline trend for the stage duration
- Parity threshold required for this promotion: the specific numerical gate
- CLASS_3 divergence count: must be zero for promotion to proceed (hard block shown visually if non-zero)
- CLASS_4 divergence count: must be zero (any non-zero is a rollback signal, shown as blocking with explanation)
- Stage duration: how long has this stage been running
- Comparison volume: how many shadow comparisons have been executed at this stage
- Replay determinism status: any nondeterminism detected in this stage? (yes/no, with link to events if yes)
- Active entropy alerts: are there fleet-level entropy signals that might be confounding the parity data?

**Trend visualization:** Parity ratio over the stage duration as a graph. Is it stable? Improving? Declining? A single ratio number without trend context is insufficient for a governance decision.

**No hidden auto-selection:** The three options — Approve Promotion, Hold at Current Stage, Rollback to Previous Stage — are presented with equal visual weight. The system does not pre-select "approve." The layout does not make "approve" easier to click. The decision is genuinely the operator's.

**Approval documentation:** The approved action is recorded with: who approved, at what time, what data was visible at the time of approval (parity ratio, divergence counts, stage duration). This creates an auditable record that the approval was informed.

---

## 7. State Explanation

**Principle:** When the system is in any non-HEALTHY state, operators immediately see: what state, why it entered that state, what is currently blocked, and what they can do.

### Requirements

Every non-HEALTHY state triggers a state explanation banner that is:
- Visible regardless of which view the operator is in (it is not hidden behind navigation)
- Specific: it names the state in constitutional terms and provides a plain-language translation
- Causal: it explains why the system entered this state (the triggering event)
- Operational: it lists what is currently blocked (which actions are unavailable and why)
- Action-oriented: it provides the primary available action and the escalation path

### State-Specific Explanations

**DEGRADED:**
> "[Venue name] is in DEGRADED state. One or more subsystems are reporting health warnings, but content delivery is continuing. Cause: [specific cause]. Impact: [what is affected]. No action required now, but this should resolve within [timeframe]. If it does not, contact [REGIONAL_MANAGER]."

**CONSTITUTIONAL_RISK:**
> "[Venue name] is in CONSTITUTIONAL_RISK state. The system has detected a significant difference between how the new resolution engine and the current system are computing content. Canary promotion is blocked until this is reviewed. Cause: [specific divergence]. Who should act: ENTERPRISE_ADMIN. What you can do now: review the divergence report [link] and contact ENTERPRISE_ADMIN."

Note: CONSTITUTIONAL_RISK is explained in operational terms ("difference between how content is computed") not technical terms ("CLASS_3 shadow divergence").

**SHADOW_ONLY:**
> "The new resolution engine is running alongside the current system, comparing results. This is a normal part of the system upgrade process. No content impact. Canary stage: [current stage]. Parity: [current ratio]."

**PRE_DISABLED:**
> "The new resolution engine has been paused. The current system is serving all content. Cause: [specific reason]. Impact: None on content delivery. Who should act: PLATFORM_ADMIN."

**READ_ONLY:**
> "The system is in Read-Only mode. All content changes — campaigns, overrides, schedule changes — are blocked until the system is restored. Cause: A constitutional integrity check failed. Content is still playing normally from cached state. What you can do: view content history, run previews, review audit logs. Who to contact: [PLATFORM_ADMIN contact information]."

Note: READ_ONLY state explicitly enumerates what the operator CAN still do, not just what is blocked.

**EMERGENCY_FREEZE:**
> "All system operations have been paused due to a data integrity concern. Screens are displaying the last verified content. No changes can be made to the system. Who to contact: [PLATFORM_ADMIN contact information, specific person or escalation number]. Duration: Unknown — this is resolved by PLATFORM_ADMIN review."

Note: EMERGENCY_FREEZE does not estimate duration. Giving a false estimate builds false expectations.

---

## Trust-Breaking Anti-Patterns

These patterns must be actively prevented. Each one represents a specific trust failure that this platform has documented as a risk.

**Preview that does not match playback.** The most significant trust failure. When this happens, operators lose confidence in preview as a verification tool and begin publishing without checking. Prevention: same resolution path enforced by contract; divergence detection via hash comparison.

**Silent state transitions.** The system transitions from HEALTHY to DEGRADED without surfacing why. The operator notices screens behaving differently but has no system-level explanation. Trust failure: "the system changed without telling me." Prevention: every state transition emits a StateTransitionLog and triggers a state explanation update.

**Vague error messages.** "Something went wrong." "Content change failed." "System error." These are not error messages — they are error acknowledgments without content. Prevention: every error surfaces the specific operation that failed, the specific reason, and the specific recovery path.

**Overrides that expired unnoticed.** An override that the operator intended to be permanent expired at midnight while no one was watching. The morning shift finds incorrect content playing. The system must prevent this through expiry warnings, handover visibility, and explicit intent confirmation for overrides that expire during unmanned periods.

**Entropy alerts without impact context.** An entropy alert fires. The operator sees a drift score and a severity level. They do not know whether this affects anything currently playing or whether it is historical drift in a period that has already passed. They escalate unnecessarily. Prevention: every entropy alert includes impact assessment (affecting content now playing / affecting future content / historical only).

**Canary promotion without supporting data.** An operator approves a canary promotion because the system shows "READY" without understanding what "READY" means or what the parity numbers represent. Prevention: the promotion approval screen requires an explicit "I have reviewed the parity data" acknowledgment and surfaces all supporting data in context.
