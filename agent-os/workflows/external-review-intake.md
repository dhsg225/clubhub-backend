# Workflow: External Review Intake

**Role**: Governance
**Trigger**: An external evaluation arrives — AI audit, human consultant report, automated analysis, peer review, etc.

---

## The Core Principle

External feedback is **input, not authority**. An external evaluator recommending "add a compliance layer" is a suggestion. It only becomes actionable if the Governance role decides it aligns with the project's actual goals. The triage workflow has an explicit discard path — use it when appropriate, and always write a reason.

The invariant: **no finding lives only in the review file**. Every finding is either absorbed into a standard governance doc or explicitly discarded. This keeps the two-file cold start intact — Feature Development agents never need to read review files.

---

## Step 1 — Create the intake file

Copy `templates/EXTERNAL_REVIEW.md` to:
```
agent-os/reviews/YYYY-MM-DD-[source]-[scope].md
```

Examples:
- `reviews/2026-06-08-kimi-architecture-audit.md`
- `reviews/2026-06-15-human-consultant-auth-review.md`
- `reviews/2026-07-01-gemini-full-codebase.md`

Fill the header (Source, Date, Scope, Status: Active). Do not triage yet.

---

## Step 2 — List findings verbatim

Copy or summarise all findings into the Findings table before making any governance decisions. Do not pre-filter. A finding you dismiss immediately still gets a row — with "Discard" and a reason.

---

## Step 3 — Triage each finding

For each finding, apply exactly one of these rules:

### → VISION.md Part 3
Use when: the finding reveals a mismatch between system topology and what the code actually does.

**Only valid if**: VISION.md sign-off has not yet happened. If the project is already past sign-off, use DECISIONS.md instead (topology corrections after sign-off are architectural decisions, not reconciliation rows).

Add a row to VISION.md Part 3 with Type = Conflict and Action = Fix code or Clarify with human.

### → DECISIONS.md
Use when: the finding identifies an architectural pattern, technology choice, or constraint that should be a recorded decision.

Create a D-NNN entry. If the governance role agrees with the finding but it requires human confirmation, set status to `Needs Human`. If the governance role rejects the finding's recommendation, still record the decision as "we considered X and decided against it — reason: Y."

### → BACKLOG.md
Use when: the finding is a concrete implementation gap, bug, missing feature, or tech debt item.

Create a BL-NNN item. Add `[source: reviews/YYYY-MM-DD-source-scope.md]` to the item's **What** field so the origin is traceable. Size the item (S/M/L/XL). Assign a Role.

### → Discard
Use when: the finding is already handled, out of scope, or does not align with the project's actual goals.

Record "Discard" in the Governance decision column. Write a one-line reason. Do not leave the reason blank — silent discards become invisible assumptions.

---

## Step 4 — Mark triage complete

When every finding has a governance decision:
1. Fill in the Triage summary section of the review file
2. Set Status: Triaged in the file header
3. Update BACKLOG.md, DECISIONS.md, or VISION.md as needed
4. The review file is now archival — do not reference it in agent sessions

---

## Step 5 — Handle stale reviews

If a newer review covers the same scope as an older one:
1. Set Status: Superseded on the older file
2. Set Superseded-by: to the path of the newer file
3. Governance agents seeing a Superseded file should not act on its findings

---

## Triage authority table

| Finding type | Destination | Notes |
|---|---|---|
| Topology mismatch (pre-sign-off) | VISION.md Part 3 | Only before VISION.md is signed |
| Topology mismatch (post-sign-off) | DECISIONS.md | Status: Needs Human |
| Architectural pattern / tech choice | DECISIONS.md | Record even if rejected |
| Implementation gap / bug | BACKLOG.md | Add [source: ...] tag |
| Already fixed / out of scope | Discard | Written reason required |
| Conflicts with project goals | Discard | Written reason required |

---

## Anti-patterns

**Don't**: Add a reviews/ file to BACKLOG.md as an item ("Review the Kimi audit"). That defers triage indefinitely and creates a parallel governance track.

**Don't**: Treat external evaluator recommendations as decisions. They're inputs. The governance role decides.

**Don't**: Leave findings without a governance decision. A finding with no decision is invisible debt.

**Don't**: Let agents read review files during feature work. If triage is complete, all signal is already in the standard docs.
