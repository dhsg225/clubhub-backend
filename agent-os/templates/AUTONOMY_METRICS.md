# Autonomy Metrics

Tracks the cost of every agent interruption. The Governance role updates this after each session.
The goal is not precision — it is identifying which interruption categories destroy the most autonomous execution time, so governance work is prioritised correctly.

---

## Severity Scoring Guide

Use this when filling in the INTERRUPTION COST section of a Stop Report. Pick the bucket that fits — do not deliberate.

| Severity | Time Lost | Workstream Impact | Recurrence |
|---|---|---|---|
| **Low** | ≤15 min | Current task only | Unlikely |
| **Medium** | ≤45 min | Current feature area | May recur |
| **High** | >45 min | Multiple backlog items | Likely to recur |
| **Critical** | >90 min | Entire workstream | Guaranteed without fix |

**Time Lost reference** (pick the closest):

| Minutes | What it looks like |
|---|---|
| 5 | A single lookup or rule check that an existing doc should have covered |
| 15 | Deliberation across 2–3 files, or a stop that required a mid-session pivot |
| 45 | Stop that ended the session, required human input, or caused a task to be skipped |
| 90 | Blocked an entire feature; human decision cycle took more than one exchange |
| 120+ | Caused rework of already-completed items, or blocked multiple sessions |

---

## Interruption Cost Log

Every stop that is not "Batch Objective Completed" gets a row here.

| # | Date | Role | Category | Description | Min Lost | Backlog Items | Workstream Impact | Recurrence | Severity | Governance Fix Applied |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — |

**Total interruptions logged**: 0
**Total estimated time lost**: 0 minutes
**Sessions affected**: 0

---

## Category Summary

Aggregated by stop category. Sorted by total time lost descending.

| Rank | Category | Occurrences | Total Min Lost | Avg Min/Stop | Governance Status |
|---|---|---|---|---|---|
| — | Human Decision Required | 0 | 0 | — | No occurrences |
| — | Missing Project Information | 0 | 0 | — | No occurrences |
| — | Missing Authority | 0 | 0 | — | No occurrences |
| — | Technical Blocker | 0 | 0 | — | No occurrences |
| — | Architectural Ambiguity | 0 | 0 | — | No occurrences |
| — | External Dependency | 0 | 0 | — | No occurrences |
| — | Context Window Pressure | 0 | 0 | — | No occurrences |
| — | Safety Concern | 0 | 0 | — | No occurrences |

---

## Governance Priority Queue

### Active (needs attention)

*None yet.*

### Resolved

| Category | Fix Applied | Date | Doc Updated |
|---|---|---|---|
| — | — | — | — |

---

## Autonomy Trend

| Session | Date | Role(s) Active | Stops | Min Lost | New Rules | Resolved Blockers | Notes |
|---|---|---|---|---|---|---|---|
| 1 | YYYY-MM-DD | — | — | — | — | — | Bootstrap session |

**Target**: Stops per session < 2, total min lost per session < 20.

---

## OS Evolution Queue

Patterns observed in this project that may generalise to Agent OS itself. The Governance role evaluates these and submits confirmed candidates to `evolution/PROPOSALS.md`.

| Observation | Sessions seen | Candidate for OS evolution? | Action |
|---|---|---|---|
| — | — | — | — |

---

## How the Governance Role Uses This File

After each session:

1. Add a row to the Interruption Cost Log for every Stop Report received (include the role that stopped).
2. Update Category Summary totals.
3. Promote any category with 2+ unresolved occurrences to the Active Governance Queue.
4. Apply governance fixes to `AUTONOMY.md` or `DECISIONS.md` and move items to Resolved.
5. Add a row to the Autonomy Trend table.
6. Check OS Evolution Queue — if the same pattern appeared in a previous session, submit to `evolution/PROPOSALS.md`.
7. If a category hits 3+ occurrences → escalate to human. If any category >90 min total → escalate immediately.

**Escalation threshold**: Any single category accumulating >90 minutes total lost time without a governance fix applied → surface to human immediately.
