# Periodic Governance Review Workflow

A periodic review examines accumulated interruption data to identify systemic patterns, evaluate governance health, and generate evolution proposals. It is distinct from the session-by-session governance improvement loop (which handles individual stops).

**Owner**: The Governance role.

---

## When to Run a Review

Use **trigger-based** timing, not calendar-based. Reviews should happen when evidence justifies them, not on a fixed schedule.

| Trigger | Review type |
|---|---|
| Every 5 Stop Reports accumulated | **Interrupt Review** — look for category patterns |
| At every major project milestone completion | **Milestone Review** — assess governance health before the next milestone |
| When any single category crosses 90 min total | **Escalation Review** — required, not optional |
| When the same Stop Report reason appears 3+ times | **Pattern Review** — targeted, write a rule immediately |
| At project completion or handoff | **Retrospective Review** — full system assessment; generate evolution proposals |

**Minimum frequency**: At least one review per milestone. Projects that run long without reviews accumulate unresolved patterns.

---

## What a Review Examines

### 1. Interruption Data (`AUTONOMY_METRICS.md`)

- Which categories have the most occurrences?
- Which categories have the highest total time lost?
- Is the trend improving (fewer stops per session over time)?
- Are there categories with governance fixes applied but still recurring?
- Are there new categories appearing that have no governance fix yet?

### 2. Governance Document Health

For each active governance document, assess:

| Document | Question |
|---|---|
| `PROJECT_STATE.md` | Is it under 100 lines? Does it reflect current code state? |
| `BACKLOG.md` | Are active items still accurate? Are DONE items cluttering it? |
| `DECISIONS.md` | Are decisions still being followed? Any that should be revisited? |
| `AUTONOMY.md` | Are zone rules being followed? Are Recurring Patterns still correct? |
| `HANDOFF.md` | Is it still accurate? Any stale "broken" items? |

### 3. Recurring Governance Failures

- Are any rules being bypassed or ignored?
- Are any rules causing unintended consequences?
- Are there patterns in *which role* is stopping most often? (A frequent Feature Development stop may indicate the Product role is writing vague backlog items. A frequent Governance stop may indicate the Architecture role isn't pre-making decisions.)

### 4. Recurring Successes

Document what is working well. Governance is not only about fixing failures — knowing what to preserve is equally important.

---

## The Review Report

After the review, the Governance role produces a brief report (not a long document — this is for rapid iteration):

```
GOVERNANCE REVIEW — [Project Name]
Date: YYYY-MM-DD
Type: [Interrupt / Milestone / Escalation / Pattern / Retrospective]
Sessions reviewed: N
Stop Reports reviewed: N

HEALTH SUMMARY
Stops per session (last 3): [N, N, N]   Target: <2
Min lost per session (last 3): [N, N, N]   Target: <20
Active governance gaps: N
Trend: [Improving / Stable / Degrading]

TOP FINDINGS (max 5)
1. [Finding — category + evidence]
2. [Finding]
...

GOVERNANCE FIXES APPLIED THIS REVIEW
- [Rule written / document updated]
- ...

AGENT OS EVOLUTION CANDIDATES
Patterns observed here that may generalise to other projects:
- [Pattern — brief description]
- ...
(Submit confirmed candidates to evolution/PROPOSALS.md)

RECOMMENDED NEXT ACTIONS
- [Specific action — file, role, or decision]
```

---

## Generating Evolution Proposals

The periodic review is the primary source of evolution proposals. A pattern becomes an evolution candidate when:

1. It occurred on this project at least twice despite governance fixes
2. It is not specific to this project's tech stack or domain
3. The current Agent OS templates or workflows would have prevented it if they contained the right rule

**How to evaluate whether something generalises**:
> "Would this pattern occur on a Python/Django project? A Next.js project? A data pipeline project?"
>
> If yes → it's a candidate for Agent OS evolution.
> If only in React Native or only with Supabase → it's a project-level rule, not an OS-level rule.

**How to submit**:
1. Write a proposal using the template in `evolution/PROPOSALS.md`
2. Append it under **Status: Draft**
3. Update the Proposal Index at the bottom of that file

---

## The Full Evolution Lifecycle

```
Observation
  (Governance role notices a repeating pattern during a review)
      ↓
Draft Proposal
  (Written using the template in evolution/PROPOSALS.md)
      ↓
In Review
  (Human or cross-project review — is it generalizable? does it conflict with existing design?)
      ↓
      ├── Rejected → record rationale in PROPOSALS.md, close
      └── Accepted → move to Accepted queue
              ↓
        Implementation
          (Apply change to affected templates/workflows/role definitions)
              ↓
        Changelog Entry
          (Add to evolution/CHANGELOG.md with version bump)
              ↓
        Update PROPOSALS.md status to Implemented
```

**Version bump rules**:
- Template wording clarification → PATCH (e.g. v2.0.1)
- New section, new role, new workflow step → MINOR (e.g. v2.1.0)
- Role model change, document structure change, breaking workflow change → MAJOR (e.g. v3.0.0)

---

## Review Anti-Patterns

**Anti-pattern**: Running a review without looking at actual interruption data.
Reviews must start with `AUTONOMY_METRICS.md`. Opinions without data produce rules that don't solve real problems.

**Anti-pattern**: Proposing an OS change for a project-specific problem.
If the rule only applies when using Supabase, or only in React Native, it belongs in `AUTONOMY.md §Recurring Patterns`, not in Agent OS templates.

**Anti-pattern**: Skipping reviews because "the project is going well."
Successful sessions produce evidence of what to preserve, not just what to fix. Retrospective reviews capture working patterns before they are forgotten.

**Anti-pattern**: Writing evolution proposals without specifying which file and what text to change.
A proposal that says "improve the stop report" is not actionable. A proposal that says "add a 'Stopped by: [role]' field to the Stop Report template in AUTONOMY.md line 47" is.
