# Backlog

Pick from the top of the active list. Mark status inline when starting/finishing. Completed item specs move to `archive/BACKLOG_ARCHIVE.md`.

**Context cost key**: S = Small (<5% context), M = Medium (5–15%), L = Large (15–30%), XL = Extra Large (>30%)

**Status key**: TODO | IN PROGRESS | DONE | BLOCKED | NO-OP | FUTURE | WAITING

---

## Active Items

### BL-001 — [Feature or fix title] `[S]`
- **What**: [What needs to be done. Be specific enough that an agent can start without asking questions.]
- **Acceptance criteria**: [How to verify it's done.]
- **Files**: [Which files to touch, if known.]
- **Role**: [Which role should handle this — Feature Development, QA, Data, etc.]
- **Source**: [Optional — e.g. `reviews/2026-06-08-kimi-audit.md` if this item came from an external review]
- **Status**: TODO

### BL-002 — [Feature or fix title] `[M]`
- **What**:
- **Acceptance criteria**:
- **Files**:
- **Blocker**: [If BLOCKED — what decision or information is missing.]
- **Role**: Feature Development
- **Status**: BLOCKED

---

## Future (no scope yet — do not build)

| Item | Description |
|---|---|
| BL-NNN | [Brief description — scoped when ready] |

---

## Completed

| Item | Date | Summary |
|---|---|---|
| — | — | — |

---

<!--
INSTRUCTIONS:

- The Product role writes items; the Feature Development role executes them.
- Pick the top-most TODO item each session. Mark IN PROGRESS when you start; DONE when verified; NO-OP if found unnecessary.
- BLOCKED items: skip entirely. Surface in Stop Report only.
- FUTURE items: do not build without explicit human scope definition.
- Move completed items to the Completed table (summary only) when detail is no longer needed.
- Add [S/M/L/XL] context cost to each item header.
- Add Role: tag so agents know which role handles each item.
- Add Source: tag if the item originated from an external review (reviews/filename). Optional for items from other sources.
-->
