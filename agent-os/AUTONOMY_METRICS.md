# Autonomy Metrics

Tracks the cost of every agent interruption. The Governance role updates this after each session.

---

## Severity Scoring Guide

| Severity | Time Lost | Workstream Impact | Recurrence |
|---|---|---|---|
| **Low** | ≤15 min | Current task only | Unlikely |
| **Medium** | ≤45 min | Current feature area | May recur |
| **High** | >45 min | Multiple backlog items | Likely to recur |
| **Critical** | >90 min | Entire workstream | Guaranteed without fix |

**Time Lost reference**:

| Minutes | What it looks like |
|---|---|
| 5 | A single lookup that an existing doc should have covered |
| 15 | Deliberation across 2–3 files, or a stop requiring a mid-session pivot |
| 45 | Stop that ended the session or required human input |
| 90 | Blocked an entire feature; human decision cycle took more than one exchange |
| 120+ | Caused rework of already-completed items, or blocked multiple sessions |

---

## Interruption Cost Log

| # | Date | Role | Category | Description | Min Lost | Backlog Items | Workstream Impact | Recurrence | Severity | Governance Fix Applied |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-06-09 | QA (CH1) | Batch Objective Completed | BL-INT-01 integration harness re-validated 34/34 GREEN after BL-002 | 0 | BL-INT-01 | Current task only | Unlikely | Low | None |
| 2 | 2026-06-09 | Feature Dev (CH2) | Batch Objective Completed | BL-011 pre-runtime Wave 4 complete — WS server, resolve loop, audit flush | 0 | BL-011 | Current task only | Unlikely | Low | None |
| 3 | 2026-06-09 | Feature Dev (CH3) | Context Window Pressure | 93% context hit during cold-start reads before any BL-012 work began | 5 | BL-012 | Current task only | Possible | Low | Spec Doc Pre-Read Exemption added to AUTONOMY.md; AGENT_REGISTRY.md updated |

**Total interruptions logged**: 3
**Total estimated time lost**: 5 minutes
**Sessions affected**: 1

---

## Category Summary

| Rank | Category | Occurrences | Total Min Lost | Avg Min/Stop | Governance Status |
|---|---|---|---|---|---|
| — | Human Decision Required | 0 | 0 | — | No occurrences |
| — | Missing Project Information | 0 | 0 | — | No occurrences |
| — | Missing Authority | 0 | 0 | — | No occurrences |
| — | Technical Blocker | 0 | 0 | — | No occurrences |
| — | Architectural Ambiguity | 0 | 0 | — | No occurrences |
| — | External Dependency | 0 | 0 | — | No occurrences |
| 1 | Context Window Pressure | 1 | 5 | 5 | Fix applied — Spec Doc Pre-Read Exemption |
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
| 1 | 2026-06-08 | Governance | 0 | 0 | 0 | 0 | Bootstrap session — harness initialised |
| 2 | 2026-06-09 | CH1+CH2+CH3+FE-1+Governance | 3 | 5 | 1 | 1 | BL-002/009/010/011 done; BL-012 queued; Claude Design pilot complete |

**Target**: Stops per session < 2, total min lost per session < 20.

---

## OS Evolution Queue

| Observation | Sessions seen | Candidate for OS evolution? | Action |
|---|---|---|---|
| — | — | — | — |
