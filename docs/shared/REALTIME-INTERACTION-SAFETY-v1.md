# ClubHub TV — Realtime Interaction Safety
# Implementation Translation Era — Operational Frontend Execution Standards

**Document type:** Implementation governance — concurrent interaction safety and race-condition prevention
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; interaction flow implementors; all contributors building operator-facing interaction surfaces
**Last updated:** 2026-05-26
**Status:** CANONICAL — interaction patterns not conforming to this document create operator-visible race conditions and are not eligible for deployment
**Phase:** Implementation Translation Era

---

## Purpose

This document governs safe interaction under live concurrent operational conditions: multiple operators acting simultaneously, live state updating while an operator is mid-action, emergency events arriving during routine operations, and the full range of timing conditions that exist in a real operational environment.

The threat this document addresses: **causality loss during live state mutation.** An operator who initiates an action based on state S1, then sees state change to S2 before the action completes, may not realize their action was initiated against S1. If the action is consequential and S2 is significantly different from S1, the operator has taken an action based on outdated context — without knowing it. This is not a technical failure. It is an interaction safety failure.

**The governing principle: operators must never lose causality awareness during live state mutation.** The system must maintain the operator's understanding of what state their action was initiated against, what state the system is currently in, and whether those two states are significantly different.

---

## Section 1 — Multi-Operator Interaction Safety

### 1.1 Concurrent Action Awareness Model

Concurrent action awareness is not access control. Two operators may act on the same scope simultaneously — the system does not prevent this. What the system must do is make each operator aware that the other is acting, before either operator commits to a consequential action.

**Awareness model:**
```
// When Operator B begins an interaction on a scope where Operator A has an in-flight action:
// - Operator B sees a non-blocking concurrent action indicator
// - Operator B is not prevented from proceeding
// - Operator B makes an informed decision with full awareness

<ConcurrentActionIndicator
  operator={operatorA.displayName}
  action={operatorA.pendingAction.description}
  scope={scope}
  initiatedAt={operatorA.pendingAction.initiatedAt}
  // This indicator appears as soon as Operator B enters the interaction flow.
  // It does not appear only after Operator B has committed.
/>
```

**Why non-blocking:** Blocking would introduce its own failure mode — operators unable to act in an emergency because someone else has an unresolved interaction on the same scope. The system provides awareness; the operators make the decision.

### 1.2 Last-Write-Wins With Attribution

When two operators submit conflicting actions for the same scope, the system applies last-write-wins semantics. Both operators must be notified of the outcome:

```
// Operator A's action was superseded by Operator B's action.
// Operator A receives:
<ActionSupersededNotification
  yourAction={operatorA.action}
  supersededBy={operatorB.displayName}
  supersedingAction={operatorB.action}
  appliedAt={resolvedTimestamp}
  // Operator A can review the current state and decide whether to re-apply.
  // Operator A is not silently failed — they are informed.
/>
```

**Forbidden:**
```
// DO NOT silently drop one operator's action when it conflicts.
// DO NOT show both operators "success" when only one action was applied.
// DO NOT merge conflicting actions without explicit operator review.
```

### 1.3 Interaction Authority Visibility

Each operator must be able to see, at any time, what interactions they currently have in progress and what interactions other operators have in progress for shared scopes:

```
<ActiveInteractionsPanel
  myInteractions={myInFlightInteractions}      // My pending actions
  sharedScopeInteractions={remoteInteractions}  // Others' actions on scopes I'm viewing
  // Groups by scope for clear spatial context
  // Each interaction shows: operator, action type, elapsed time, scope
/>
```

---

## Section 2 — Concurrent Edit Visibility

### 2.1 Field-Level Conflict Detection

When an operator is editing a form (override creation, schedule modification) and a remote update arrives that changes the field they are editing:

```
function onRemoteUpdateDuringEdit(field, newRemoteValue, operatorDraftValue) {
  // Show the conflict inline — do not silently update the field.
  setFieldConflict(field, {
    currentOperatorValue: operatorDraftValue,
    newRemoteValue,
    remoteOperator: remoteUpdate.operator,
    remoteTimestamp: remoteUpdate.preTimestamp,
  });
  // The operator sees: "This field was updated by [Operator] while you were editing."
  // The operator chooses: keep their value or adopt the remote value.
  // DO NOT automatically overwrite the operator's draft.
}
```

### 2.2 Form Context Staleness

An operator may spend several minutes completing a complex form (fleet-wide override, sponsorship adjustment). By the time they submit, the context they were acting on may have changed significantly.

**Form context snapshot:**
```
// When a form is opened, snapshot the operational context it was opened against.
const formContext = snapshotOperationalContext(scope, preOperationalClock.now());

// When the form is about to be submitted, compare current context to snapshot.
function onFormSubmit(formData) {
  const currentContext = snapshotOperationalContext(scope, preOperationalClock.now());
  const contextDrift = measureContextDrift(formContext, currentContext);

  if (contextDrift.severity >= 'SIGNIFICANT') {
    // Surface the context drift before confirming submission.
    showContextDriftWarning(contextDrift, () => {
      // Operator acknowledges the drift and confirms submission.
      submitForm(formData);
    });
  } else {
    submitForm(formData);
  }
}
```

**Significant context drift definition:**
- A venue health grade changed by 2+ grades
- An emergency state was activated or deactivated
- A relevant override was created, modified, or expired
- The scope entered a degraded synchronization state

---

## Section 3 — Intent Collision Prevention

### 3.1 Stale-Action Detection

A stale action is an action that was initiated against state S1 but submitted after the system has moved to state S2 where the action's original intent may no longer apply.

**Stale action detection:**
```
// When the operator's in-flight action has a context mismatch with current state,
// surface the mismatch before applying the action.

function beforeActionCommit(action, contextAtInitiation, currentContext) {
  const mismatch = detectContextMismatch(contextAtInitiation, currentContext);

  if (mismatch.isConsequential) {
    return {
      blocked: true,
      reason: mismatch.description,
      // e.g., "The emergency state you were responding to was resolved
      //        while you were completing this action."
      recommendation: mismatch.recommendation,
      // Allow operator to: revise action, cancel action, or proceed with awareness.
    };
  }
  return { blocked: false };
}
```

### 3.2 Irreversible-Action Protections

For irreversible or high-consequence actions, additional protections apply:

```
// 3-second delay after final confirmation — visible countdown.
// Operator can cancel during this window.
<IrreversibilityDelay
  action={pendingIrreversibleAction}
  delayMs={3_000}
  onCancel={handleCancel}
  // Countdown is visible: "Applying in 3... 2... 1..."
  // If a Tier 4+ event arrives during delay, delay is preserved — the event
  // does not automatically cancel or confirm the pending action.
/>

// Typed confirmation for highest-consequence actions (fleet-wide changes).
<TypedConfirmation
  requiredText={`CONFIRM FLEET OVERRIDE`}
  action={pendingAction}
  // Operator must type the confirmation text exactly.
  // Auto-fill is disabled.
/>
```

### 3.3 Intent Collision Disclosure

When two operators have initiated conflicting intents on the same scope:

```
// Both operators see the collision before either commits.
<IntentCollisionWarning
  myIntent={localOperatorIntent}
  conflictingIntent={remoteOperatorIntent}
  scope={scope}
  // Neither operator's intent is automatically cancelled.
  // Both operators decide independently whether to proceed, revise, or yield.
  // The collision is visible before commitment, not after.
/>
```

---

## Section 4 — Stale-Action Prevention

### 4.1 Action Context Binding

Every action is bound to the PRE operational clock timestamp of the state it was initiated against:

```
// Action initiation captures the context timestamp.
{
  actionType: 'OVERRIDE_CREATE',
  scope: scope,
  initiatedAt: preOperationalClock.now(),
  contextTimestamp: authoritativeState.preTimestamp,
  // contextTimestamp is the timestamp of the PRE output the operator was viewing.
  // NOT the device timestamp of when they clicked.
}
```

### 4.2 Context Age Threshold

Actions whose context timestamp exceeds the stale-action threshold must not be submitted without operator acknowledgment:

```
const STALE_ACTION_THRESHOLDS = {
  'IF-01_OVERRIDE_CREATION': 60_000,       // 60 seconds
  'IF-02_EMERGENCY_ACTIVATION': 30_000,    // 30 seconds
  'IF-03_SPONSORSHIP_MODIFICATION': 120_000,
  'IF-06_FLEET_INTERVENTION': 30_000,      // 30 seconds — high blast radius
};

function validateActionContext(action) {
  const contextAge = preOperationalClock.now() - action.contextTimestamp;
  const threshold = STALE_ACTION_THRESHOLDS[action.actionType];

  if (contextAge > threshold) {
    return {
      valid: false,
      reason: `Context is ${Math.round(contextAge/1000)}s old (threshold: ${threshold/1000}s)`,
      recommendation: 'Review current state before proceeding',
    };
  }
  return { valid: true };
}
```

---

## Section 5 — Live-Update Interruption Handling

### 5.1 Safe Interruption Rules

A live update may interrupt an operator interaction in progress only under defined conditions:

| Update tier | May interrupt non-critical interaction | May interrupt emergency flow |
|---|---|---|
| Tier 0–2 (passive) | No — queued until interaction completes | No |
| Tier 3 (attention-worthy) | Yes — non-blocking banner only | No |
| Tier 4 (escalation-critical) | Yes — blocking modal if not in emergency flow | No |
| Tier 5 (system-critical) | Yes — blocking modal | No — emergency flow is uninterruptible |

**Emergency activation flow (IF-02) is uninterruptible by any event, at any tier.** An operator who has begun emergency activation must complete it without interruption. The system queues all events during the emergency flow and applies them after the flow completes.

### 5.2 Unsafe Interruption Examples

The following are explicitly unsafe and forbidden:

```
// UNSAFE: Closing or replacing a form on remote state update.
useEffect(() => {
  if (remoteStateUpdate) closeCurrentForm(); // FORBIDDEN
}, [remoteStateUpdate]);

// UNSAFE: Resetting form fields on live event arrival.
useEffect(() => {
  if (liveEvent.scope === formScope) resetForm(); // FORBIDDEN
}, [liveEvent]);

// UNSAFE: Navigating away from a form on synchronization state change.
useEffect(() => {
  if (syncState === 'STALE') navigate('/'); // FORBIDDEN — operator loses work
}, [syncState]);
```

### 5.3 Draft Preservation on Interruption

When a Tier 4+ event interrupts an in-progress interaction:

```
// The draft is preserved — not discarded.
// After the interruption is acknowledged, the operator sees their draft and current state.

function onTier4InterruptionAcknowledged() {
  if (savedDraft) {
    showDraftResumption({
      draft: savedDraft,
      currentState: authoritativeState,
      contextDrift: measureContextDrift(savedDraft.context, authoritativeState),
      // Operator decides: resume draft, revise draft, or start fresh.
    });
  }
}
```

---

## Section 6 — Replay Interruption Governance

### 6.1 Live Events During Replay

While an operator is in replay mode, live events continue to arrive and are applied to the live state model in the background. They are not rendered.

**Replay interruption rules:**
```
// Live events during replay:
// - Applied to live state model (background, not rendered)
// - NOT applied to replay state model
// - NOT shown to the operator during replay
// - Available when replay exits (via reconciliation summary)

// Exception: Tier 4+ events during replay are surfaced as banners.
// They do not exit replay mode — they disclose that something significant happened.
<ReplayInterruptionBanner
  event={tier4Event}
  message={`${tier4Event.description} occurred while you were in replay.`}
  // Allows operator to continue replay or exit to address the live event.
  onContinueReplay={() => {}}
  onExitToLive={() => exitReplayMode()}
/>
```

### 6.2 Replay Exit Reconciliation

When replay exits, the operator sees a reconciliation summary of what changed in live while they were in replay:

```
<ReplayExitReconciliation
  replayDuration={replayDuration}
  changesWhileInReplay={liveChanges}
  // Groups changes by: significant (emergency, health grade change, new override)
  // vs. routine (passive content transitions, minor health fluctuations)
  // Significant changes are expanded by default.
  // Routine changes are collapsed with a count.
/>
```

---

## Section 7 — Emergency Interaction Prioritization

### 7.1 Emergency Access Path

The emergency activation path (IF-02) must remain accessible regardless of current UI state:

```
// Emergency activation control is always reachable within 5 taps from any view.
// It is not gated behind navigation, scroll, or collapsed panels.
// It is not disabled by STALE or DEGRADED state.
// It is not disabled by other in-progress interactions.

// Emergency button accessibility rule:
// If emergency button is not visible within the current viewport, it is accessible
// via a persistent affordance (fixed position, always on top of z-order).
<EmergencyActivationTrigger
  position="FIXED"
  alwaysAccessible={true}
  disabledStates={[]} // Empty — never disabled
/>
```

### 7.2 Emergency Preemption of Pending Actions

When emergency activation is initiated while the operator has pending actions:

```
// Pending actions are NOT automatically cancelled.
// The operator is shown their pending actions and asked to acknowledge.
// This is a prompt, not a block — emergency takes priority.

<EmergencyWithPendingActionsWarning
  pendingActions={pendingActions}
  message="You have pending actions. They will remain pending during emergency activation."
  // Operator can: proceed with emergency (pending actions remain), or cancel pending actions first.
  // Emergency activation is never prevented by pending actions.
/>
```

---

## Section 8 — Focus Preservation During Live Updates

### 8.1 Focus Must Not Be Stolen

Live state updates must never move keyboard focus away from where the operator has placed it:

```
// A live update arriving while an operator has focus on a form field
// must not move focus to a notification banner.
// A live update arriving while an operator is mid-type
// must not clear the field or trigger form re-render.

// Implementation requirement:
// All live update side effects are applied without triggering React re-mounts
// of the focused component. Focused elements use refs, not re-rendered keys.
```

### 8.2 Notification Placement Without Focus Disruption

```
// New notifications appear in a fixed region that does not overlap form surfaces.
// The notification region receives focus only if the operator explicitly navigates to it.
// Tab order is not affected by notification arrival.

<NotificationRegion
  position="TOP_RIGHT"  // Does not overlap center/left operational panels
  focusOnArrival={false}
  // Tier 4+ notifications use an audible cue and visual prominence,
  // not focus steal, to demand attention.
/>
```

---

## Section 9 — Rollback-Safe Interaction Patterns

### 9.1 Rollback Visibility

When an action is rejected and rolled back, the rollback must be visually distinct from a forward transition:

```
// Rollback uses a distinct visual treatment — different direction, different color.
// "This is returning to prior state" is communicated visually, not only textually.

<RollbackTransition
  fromState={rejectedTargetState}
  toState={confirmedPriorState}
  rollbackReason={rejectionReason}
  // Visual: reverse direction animation (if position transition was used going forward)
  // Label: "Override application rejected — displaying prior state"
  // Duration: same as forward transition (400ms for value changes)
/>
```

### 9.2 Rollback-Safe Form Patterns

Forms that submit state-modifying actions must preserve the pre-submission state:

```
// Before form submission, snapshot the current state.
// If the submission is rejected and rolled back, the form can be restored
// with the operator's inputs intact — they do not have to re-enter their work.

const preSubmissionSnapshot = snapshotFormState(formState);

function onSubmissionRejected(rejectionReason) {
  // Show rejection reason.
  // Offer to restore the form with the operator's prior inputs.
  offerFormRestoration(preSubmissionSnapshot, rejectionReason);
}
```

---

## Section 10 — Race-Condition Visibility

### 10.1 Race Condition Detection

A race condition in the interaction layer is when two actions compete to modify the same state and the outcome is non-deterministic from the operator's perspective.

**Race condition disclosure:**
```
// When the backend detects and resolves a race condition (last-write-wins),
// both affected operators are notified.

<RaceConditionNotification
  yourAction={operatorA.action}
  competingAction={operatorB.action}
  appliedAction={winner}         // Which action was applied
  rejectedAction={loser}         // Which action was rejected
  resolutionRule="LAST_WRITE_WINS"
  resolvedAt={preTimestamp}
  // Operator can review the applied state and decide whether to re-apply their action.
/>
```

### 10.2 Visibility of In-Flight Contention

Before a race condition is resolved, the frontend surfaces contention:

```
// When two in-flight actions are known to be competing for the same scope:
<ContentionIndicator
  scope={scope}
  myAction={localPendingAction}
  competingAction={remotePendingAction}
  // Not a block — awareness only.
  // Operator can wait for resolution or withdraw their action.
/>
```

---

## Section 11 — Concurrency Ergonomics

### 11.1 Maximum Concurrent Pending Actions

An operator should not have more pending actions than they can track:

```
const MAX_CONCURRENT_PENDING_ACTIONS = 5;
// Above this limit, new actions are blocked with explanation:
// "You have [N] actions awaiting confirmation.
//  Please wait for them to resolve before initiating additional actions."
// This is not a hard technical limit — it is a cognitive safety limit.
// Emergency actions are exempt from this limit.
```

### 11.2 Pending Action Summary

When multiple actions are in-flight, the operator has a single surface that summarizes all pending actions:

```
<PendingActionsSummary
  actions={pendingActions}
  // Each action shows: type, scope, elapsed time, status
  // Grouped by scope for spatial context
  // Allows the operator to cancel a pending action if they change their mind
  onCancelAction={handleCancelAction}
/>
```

---

## Related Documents

**INTERACTION-SEQUENCING-SPEC.md** — The canonical interaction flows (IF-01 through IF-07) that this document's safety rules operate around.

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — The concurrency governance rules (Section 3) that this document's interaction interruption rules (Section 5) extend for the operator interaction layer.

**FRONTEND-IMPLEMENTATION-PATTERNS-v1.md** — The PENDING state rendering patterns (Pattern PE-01, PE-02) that this document's interaction safety rules depend on.

**OPERATIONAL-FRONTEND-OBSERVABILITY-v1.md** — The interaction latency and audit trail requirements (Sections 5–9) that capture the interaction safety data for post-incident investigation.

**FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md** — The degraded state rules that define when consequential interactions are blocked (STALE state) and when they remain permitted despite degradation (read operations).

---

*End of REALTIME-INTERACTION-SAFETY-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Multi-operator state resolution (last-write-wins, race conditions): Agent 2 authority*
*Emergency activation authority constraints: Agent 1 co-authority*
*Interaction safety ergonomics and focus preservation: Agent 3 definition authority*
