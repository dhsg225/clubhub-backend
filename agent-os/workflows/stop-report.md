# Stop Report Workflow

The Stop Report is the primary feedback mechanism in Agent OS. Every stop that is not "Batch Objective Completed" must produce one — regardless of which role is stopping.

---

## Why This Exists

Without structured stop reports:
- The human doesn't know what was finished and what wasn't
- The same interruption recurs in the next session
- Governance gaps accumulate silently
- Cost of interruptions is invisible and therefore never prioritised

With structured stop reports:
- Every stop is categorised and costed
- Avoidable stops become governance rules
- The Governance role can prioritise governance investment by actual cost
- Session continuity is preserved across context resets

---

## The Template

The Stop Report template lives in `AUTONOMY.md §MANDATORY STOP PROCEDURE`. The stopping agent fills it; the Governance role processes it.

For reference:

```
STOP REPORT

Stopped by: [role — e.g. Feature Development, QA, Data]

Reason For Stopping:
[ ] Batch Objective Completed
[ ] Missing Project Information
[ ] Missing Authority
[ ] Architectural Ambiguity
[ ] Technical Blocker
[ ] External Dependency
[ ] Human Decision Required
[ ] Safety Concern
[ ] Context Window Pressure
[ ] Other: _______________

Description: [What specifically caused the stop?]

Could this have been avoided? YES / NO
If YES → Recommended Governance Improvement:
  [ ] DECISIONS.md  — decision that should have been pre-made
  [ ] AUTONOMY.md   — rule or pattern that should have existed
  [ ] CLAUDE.md     — context or convention that was missing
  [ ] BACKLOG.md    — task spec that was too vague
  [ ] HANDOFF.md    — state that was stale or missing
  [ ] evolution/PROPOSALS.md — this looks like an Agent OS gap, not a project gap

INTERRUPTION COST
Estimated Time Lost: ___ minutes
Affected Backlog Items: [IDs]
Workstream Impact: [ ] Current task only / feature area / multiple items / entire workstream
Future Impact: [ ] No future impact / may affect agents / likely to recur / guaranteed to recur
Severity: [ ] Low / Medium / High / Critical
Reasoning: [one sentence]

Current State:
What was completed this session?
What remains incomplete?

Recommended Next Action: [specific — name the file, task ID, or decision needed]
```

---

## Stop Categories — When to Use Each

| Category | Use when |
|---|---|
| **Batch Objective Completed** | The assigned work is done. No governance note needed. |
| **Missing Project Information** | You need a fact that should be in `HANDOFF.md`, `CLAUDE.md`, or `PROJECT_STATE.md` but isn't. |
| **Missing Authority** | The action required is in Yellow or Red Zone and you need human approval. |
| **Architectural Ambiguity** | Two equally valid approaches exist and the choice has lasting implications not covered by `DECISIONS.md`. |
| **Technical Blocker** | A bug, incompatibility, or missing dependency prevents progress. |
| **External Dependency** | Progress requires an action by a third party (deploy, API key, service configuration). |
| **Human Decision Required** | A product or design decision is needed that is not covered by `DECISIONS.md`. |
| **Safety Concern** | The required action could cause data loss, security exposure, or irreversible change. |
| **Context Window Pressure** | The context window is approaching its limit before work is complete. |

---

## Severity Scoring

Quick reference (full guide in `AUTONOMY_METRICS.md`):

- **Low**: ≤15 min lost, current task only, unlikely to recur
- **Medium**: ≤45 min lost, or current feature area, or may recur
- **High**: >45 min lost, or multiple backlog items affected, or likely to recur
- **Critical**: >90 min lost, or entire workstream blocked, or guaranteed to recur without fix

When in doubt, round up. Underestimating severity means governance gaps get deprioritised.

---

## Governance Role: Processing Steps

When the Governance role receives a Stop Report:

1. **Add to Interruption Log** — new row in `AUTONOMY_METRICS.md §Interruption Cost Log` (include the stopping role)
2. **Update Category Summary** — increment count and total minutes for that category
3. **Apply governance fix** (if avoidable):
   - Write the rule in the appropriate document
   - Move item to `AUTONOMY_METRICS.md §Governance Priority Queue → Resolved`
4. **Update Autonomy Trend** — add a session row
5. **Update `PROJECT_STATE.md`** — reflect what was completed and what's pending
6. **Update `BACKLOG.md`** — mark completed items DONE; reorder if priorities shifted
7. **Check escalation thresholds**:
   - Same category 3+ times → escalate to human
   - Any category >90 min total → escalate to human immediately
8. **Check OS Evolution Queue** — if the same avoidable pattern has appeared before, submit to `evolution/PROPOSALS.md`

---

## Rules the Governance Role Enforces

- "Batch Objective Completed" is the only stop that needs no governance recommendation.
- If an avoidable stop has no governance recommendation, the Stop Report is incomplete. Request clarification.
- Every governance fix must be applied before the next session, not queued for later.
- Governance improvements are not optional — they are the output of every Stop Report except clean completions.

---

## Anti-Patterns to Avoid

**Anti-pattern**: Filing a vague Stop Report.
> "Technical blocker: couldn't complete the feature."

**Correct**:
> "Feature Development — Technical Blocker: `restaurantService.getByCity()` returns `null` instead of `[]` when no results found, causing a crash at `RestaurantsScreen.tsx:87`. Null check is missing. 15 min lost, current task only, Low. Recommended: add null-safe return pattern to AUTONOMY.md Recurring Patterns."

**Anti-pattern**: Skipping the Stop Report because the work was "almost done."
Every stop without a report means the next agent starts blind. File it.

**Anti-pattern**: The Governance role queueing fixes for later.
If the fix is clear, apply it now. A queued fix is a guaranteed repeat interruption.

**Anti-pattern**: Describing what role "should" have stopped without naming the actual role.
Always include the stopping role. It helps pattern-match which role configurations cause which interruption types.
