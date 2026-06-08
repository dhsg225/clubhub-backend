# Horizon Review Workflow

The Horizon role has two modes: **Milestone Mode** (structured, runs at the start of each milestone) and **Freeflow Mode** (interactive, human-triggered at any time). Both write to the same outputs. Both require the same grounding step.

---

## Grounding Step — Required for Both Modes

Before any horizon thinking, the agent must be anchored in reality. Run this before engaging:

```
1. Read PROJECT_STATE.md             — what's working, what's not, active blockers
2. Read BACKLOG.md (active items)    — what's being built right now and next
3. Read DECISIONS.md                 — what's already settled (don't re-litigate these)
4. Read HORIZON.md                   — open questions and ideas already in flight
5. Skim key architecture files:
   - lib/events/emitBusinessEvent.ts
   - lib/events/eventRouter.ts
   - lib/actions/executionDispatcher.ts
   - lib/db/schema.ts (table list only)
```

**Rule**: Do not engage with product or architecture questions until the grounding step is complete. A horizon agent that hasn't read the code will validate bad ideas instead of stress-testing them.

---

## Mode 1 — Milestone Mode (structured)

**When to run**: At the start of each new milestone, before any BACKLOG items for that milestone are written.

**Trigger**: Human or Governance role initiates. Takes ~30–60 min.

### Step 1 — Audit the upcoming milestone scope

Read the next milestone's intent (from `PROJECT_STATE.md` or human description). Ask:

- What architectural decisions will this milestone require that aren't already in `DECISIONS.md`?
- What existing code will this milestone stress or break?
- Are any current HORIZON.md open questions blocking this milestone?
- Does the milestone change the system topology described in `VISION.md`?

### Step 2 — Answer the five horizon questions

Write answers to all five. These become the structured output.

```
H1. DECISION GAPS
What decisions will the next milestone's Feature Development agent need that aren't
pre-made in DECISIONS.md? List each as a candidate D-NNN entry.

H2. ARCHITECTURE RISKS
What in the current codebase is most likely to cause problems as this milestone ships?
(Not bugs — risks: scaling assumptions, tight coupling, code mirrors, synchronous flows.)

H3. VISION DRIFT
Has anything changed in what we're building that makes VISION.md stale or wrong?
What needs updating before agents act on an outdated mental model?

H4. BACKLOG READINESS
Are the upcoming BACKLOG items specific enough for a Feature Development agent to execute
without stopping? Which items are likely to cause a Missing Project Information stop?

H5. FUTURE BETS
Any ideas, risks, or directions worth tracking that aren't urgent but shouldn't be lost?
These go to HORIZON.md §Open Questions as 🔵 Future bet entries.
```

### Step 3 — Write outputs

1. **Pre-populate `DECISIONS.md`**: Write D-NNN entries for every decision gap identified in H1. Mark them `[NEEDS HUMAN]` if a human call is required, or `[AGENT DECIDED]` if the agent can resolve it from context.

2. **Update `HORIZON.md`**: 
   - Promote urgent items to 🔴 if they block the next milestone
   - Add new architecture risks from H2
   - Add new future bets from H5
   - Add a row to the Session Log

3. **Update `VISION.md`**: If H3 identified drift, update the affected sections. Do not rewrite the whole document — patch only what's wrong.

4. **File a Stop Report** (per MANDATORY STOP PROCEDURE in `CLAUDE.md`).

---

## Mode 2 — Freeflow Mode (interactive)

**When to run**: Anytime the human wants to think out loud about architecture, product direction, or future plans.

**Trigger**: Human says something like "I want to think through X" or "/horizon" command.

### Protocol

1. Complete the Grounding Step above before responding to the idea.

2. Engage with the idea honestly — the agent's job is to **stress-test**, not to agree. Ask:
   - Does this conflict with a settled decision in `DECISIONS.md`?
   - Does the code support this, or would it require significant rework?
   - What's the simplest version of this idea? What's the expensive version?
   - What would we have to give up or break to do this?

3. Keep the conversation grounded. If the human proposes something that contradicts how the code actually works, say so immediately — with the file and line if you know it.

4. **Before ending the session**, write anything that crystallised:
   - Resolved → `DECISIONS.md` (new D-NNN entry)
   - Still open → `HORIZON.md §Open Questions` (with urgency tier)
   - Raw idea, not ready → `HORIZON.md §Ideas in Flight`

5. File a Stop Report.

### What the Horizon agent does NOT do

- Does not agree with ideas to be helpful — honesty is the value
- Does not build code (that's Feature Development's role)
- Does not re-open settled decisions without strong evidence the decision is wrong
- Does not generate a long document if a short entry in HORIZON.md is sufficient

---

## Output Targets

Both modes write to the same three documents:

| Document | What goes there |
|---|---|
| `HORIZON.md` | Open questions, ideas in flight, architecture risks, session log |
| `DECISIONS.md` | Pre-made decisions (D-NNN entries) ready for Feature Development to consume |
| `VISION.md` | Updated topology or constraint descriptions when product direction shifts |

Nothing else. Horizon does not write to BACKLOG.md directly — if an open question resolves into a task, hand it to the Product role to write the backlog item.
