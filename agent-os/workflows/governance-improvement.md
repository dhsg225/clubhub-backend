# Governance Improvement Workflow

Governance improvement is the Governance role's core function, not a cleanup task. The goal is a measurable reduction in interruptions per session over time.

---

## The Loop

```
Any role works
      ↓
Stop (or completion)
      ↓
Stop Report filed (by the stopping role)
      ↓
Governance role processes report
      ↓
Governance rule written (if avoidable stop)
      ↓
Next session: that role runs further without stopping
      ↓
Repeat
```

The system improves each cycle. A project with a well-run governance loop should reach near-zero interruptions within 3–5 sessions.

---

## Trigger Points

The Governance role should review and improve governance:

1. **After every session** — process Stop Reports immediately
2. **When any category accumulates 2 stops** — the pattern is established; write the rule
3. **When a category hits 3 stops** — escalate to human (root cause may be structural)
4. **When any category crosses 90 min total** — immediate escalation to human
5. **Proactively before a large backlog item** — predict what decisions will arise; pre-make them in `DECISIONS.md`

---

## The Governance Fix Decision Tree

For each avoidable stop, the Governance role answers:

```
Was the stop caused by a missing rule or pattern?
├── YES → Add to AUTONOMY.md §Recurring Patterns or §Green/Yellow/Red Zone
│         (e.g. "When X happens, always do Y without asking")
└── NO  →
    Was it caused by a missing architectural decision?
    ├── YES → Add to DECISIONS.md as D-NNN
    │         If human input needed: Status = "Needs Human"
    └── NO  →
        Was it caused by missing context (fact about the project)?
        ├── YES → Add to CLAUDE.md or HANDOFF.md
        └── NO  →
            Was it caused by a vague BACKLOG item?
            ├── YES → Rewrite with specific acceptance criteria
            └── NO  →
                Was it caused by stale HANDOFF.md state?
                ├── YES → Update HANDOFF.md; add "verify before fixing" reminder
                └── NO  →
                    Does this pattern likely affect other projects?
                    └── YES → Submit to evolution/PROPOSALS.md
```

---

## Writing a Good Governance Rule

A good rule has three parts:

1. **Trigger condition** — the exact situation that fires the rule
2. **Action** — what to do (not "consider doing" — what to actually do)
3. **Why** — the rationale (prevents agents from working around it when they think they know better)

**Weak rule**:
> When a screen needs navigation, update the navigator.

**Strong rule**:
> When a new screen needs navigation: (1) add the route to `src/navigation/types.ts` ParamList, (2) add `Stack.Screen` to the appropriate navigator file, (3) this is a Green Zone operation — no announcement needed.

The strong rule removes ambiguity and tells the agent exactly what to touch.

---

## Governance Document Responsibilities

| Document | What goes in it | When to update |
|---|---|---|
| `AUTONOMY.md §Green Zone` | Actions always safe for Feature Development | When a recurring safe pattern is identified |
| `AUTONOMY.md §Yellow Zone` | Actions needing announcement | When a pattern needs care but not a full stop |
| `AUTONOMY.md §Red Zone` | Actions needing human approval | When a production risk is identified |
| `AUTONOMY.md §Recurring Patterns` | Situation → specific resolution | Every time the same situation recurs |
| `DECISIONS.md` | Permanent architectural decisions | When a decision is made (immediately) |
| `CLAUDE.md` | Architecture and convention facts | When the architecture changes |
| `HANDOFF.md` | Current implementation state | After each feature area completion |
| `AUTONOMY_METRICS.md` | Interruption costs and trends | After each session |

---

## Proactive Governance (Before Sessions)

The highest-value governance work happens *before* a session, not after.

Before a session implementing a large feature:

1. Read the BACKLOG item
2. List every decision the Feature Development role will have to make
3. For each decision: is it already in `DECISIONS.md`? Is it covered by a Recurring Pattern?
4. For any uncovered decision: either make it (add to `DECISIONS.md`) or flag it to the human
5. Check if any schema, type, or API the feature depends on actually exists in the codebase

This is "decision pre-making" — encoding answers before they become interruptions.

**Example**: Before building a "user profile" feature:
- Does a `User` type exist? Where?
- What database table stores user data?
- Can agents read from this table? (permissions / RLS)
- What UI components should the profile screen use?
- Where does the profile screen live in the navigation hierarchy?

Each unanswered question is a potential stop. Answer them in `DECISIONS.md` or `CLAUDE.md` first.

---

## Escalation to Human

Some governance issues cannot be resolved by the Governance role. Escalate when:

- The same stop category has occurred 3+ times despite governance fixes (structural problem)
- A stop category exceeds 90 minutes total (cost too high to absorb)
- A required decision involves product direction, not implementation
- Two `DECISIONS.md` entries directly conflict (only the human can resolve)
- The governance system itself has a gap (the Agent OS templates need updating — submit to `evolution/PROPOSALS.md`)

**How to escalate**: Clear summary in the next human communication:
- Category that triggered the escalation
- Number of occurrences
- Total time lost
- What governance was already tried
- What structural change is needed

---

## Governance Health Metrics

Track in `PROJECT_STATE.md §Governance Health`:

| Metric | Target |
|---|---|
| Stops per session | < 2 |
| Minutes lost per session | < 20 |
| Active governance gaps | 0 |
| Escalation threshold hit | No |

If any metric is out of target for 2+ consecutive sessions, the Governance role must take action (not just note it).
