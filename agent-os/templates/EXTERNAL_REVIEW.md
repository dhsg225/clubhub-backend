# External Review — [Source] — [YYYY-MM-DD]

**Source**: [Who or what produced this — e.g. "Kimi AI audit", "Gemini code review", "human consultant: Jane Smith", "automated lint report"]
**Date**: YYYY-MM-DD
**Scope**: [What was evaluated — e.g. "full codebase architecture", "authentication module", "database schema"]
**Status**: Active | Triaged | Superseded
**Superseded-by**: [If Status=Superseded — path to the newer review file that replaces this one]

---

## Findings

List each finding from the external source. Be faithful to the original — do not interpret or filter yet. Triage happens below.

| # | Finding | Governance decision | Absorbed into | Reason if discarded |
|---|---|---|---|---|
| 1 | [Verbatim or lightly summarised finding] | Accept / Modify / Discard | [BACKLOG BL-NNN / DECISIONS D-NNN / VISION.md Part 3 / —] | [Required if Discard] |
| 2 | | | | |

---

## Triage: [Pending / Complete]

*(Governance role fills this section. Feature Development agents do not read review files during normal work — findings are absorbed into standard governance docs.)*

**Triaged by**: [Role + date]

**Summary of absorption**:
- BACKLOG: [list BL-NNN items created]
- DECISIONS: [list D-NNN items created or updated]
- VISION.md: [list reconciliation rows added, if any]
- Discarded: [count] findings — reasons recorded in table above

**After triage**: This file is archival. All actionable signal now lives in standard governance docs. Do not re-read this file during feature work.

---

<!--
INSTRUCTIONS:

1. Create this file at: agent-os/reviews/YYYY-MM-DD-source-scope.md
2. Fill the header fields immediately on receipt.
3. List all findings verbatim before triaging — do not pre-filter.
4. Triage each finding to exactly one destination:
   - Topology or constraint mismatch → VISION.md Part 3 reconciliation row
     (only if VISION.md sign-off has not yet happened — otherwise use DECISIONS.md)
   - Architectural pattern or decision → DECISIONS.md (status: Needs Human if unresolved)
   - Implementation gap or bug → BACKLOG.md item (add [source: reviews/filename] tag)
   - Already handled / not applicable → Discard with written reason
5. The governance role has veto power. An external recommendation only becomes actionable
   if governance decides it aligns with the project's actual goals. Discard is a valid outcome.
6. Mark Status: Triaged when every finding has a governance decision.
7. Mark Status: Superseded if a newer review covers the same scope and this one is stale.
   Set Superseded-by to the newer file path.
-->
