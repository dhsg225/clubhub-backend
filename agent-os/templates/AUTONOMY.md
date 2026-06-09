# Autonomy Rules — What Agents Can Do Without Asking

This file defines the thresholds for autonomous action vs. human check-in for **[PROJECT NAME]**.

Zone rules apply to whichever agent is active. The rules reference roles, not agent names.

---

## RESUME PROTOCOL — Read This First

Do not load all coordination files on session start. Tiered reading preserves context for actual work.

**Tier 1 — Always read (every session):**
1. `PROJECT_STATE.md` — current status, blockers, next actions (~4 min)
2. `BACKLOG.md` — pick your task (~2 min, active items only)

**Tier 2 — Read on demand (only when your task requires it):**
- `DECISIONS.md` — only when you hit a decision point; search for the relevant D-NNN
- `HANDOFF.md` — only if you need implementation detail on a specific feature
- `CLAUDE.md` — only when you need a convention (styling, architecture pattern, etc.)

**Tier 3 — Never read on cold start:**
- `AUTONOMY.md` — you are reading it now; do not re-read it next session unless a zone question arises
- `AUTONOMY_METRICS.md` — Governance role only

**Rule**: If you have read more than 2 files without starting a task, stop loading files and start working.

---

## Governance Role — Responsibilities

The agent(s) holding the Governance role are responsible for:
1. **Project Memory** — `PROJECT_STATE.md` kept current and ≤100 lines after every session
2. **Context Compression** — active docs stay lean; completed detail moves to `archive/`
3. **Autonomy Improvement** — `AUTONOMY_METRICS.md` updated after every session
4. **Project State Management** — `HANDOFF.md` and `BACKLOG.md` reflect verified code state
5. **OS Evolution** — recurring project-level patterns that may generalise submitted to `evolution/PROPOSALS.md`

**Context Compaction Rule**: When any active document exceeds ~150 lines of completed/historical content, compress it. Move build specs to `archive/BACKLOG_ARCHIVE.md`. Keep only summaries in active docs. Decisions stay in `DECISIONS.md` but compress shipped items to a single paragraph. `PROJECT_STATE.md` is always the entry point — keep it under 100 lines.

**Resume Optimisation**: An agent resuming work should reach productive context by reading `PROJECT_STATE.md` and `BACKLOG.md`. No other files should be required for standard tasks.

---

## MANDATORY STOP PROCEDURE

Whenever work pauses for **any reason**, produce a Stop Report before handing back to the human. No exceptions. A stop without a report is a governance failure.

```
STOP REPORT

Stopped by: [role of the agent stopping — e.g. Feature Development, QA]

Reason For Stopping:

Choose one:
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

---

Description:

What specifically caused the stop?

---

Could this have been avoided?

YES / NO

If YES — what governance change would have prevented it?

Recommended Governance Improvement:

Specific update needed (check all that apply):
[ ] DECISIONS.md  — decision that should have been pre-made
[ ] AUTONOMY.md   — rule or pattern that should have existed
[ ] CLAUDE.md     — context or convention that was missing
[ ] BACKLOG.md    — task spec that was too vague
[ ] HANDOFF.md    — state that was stale or missing

Agent OS Evolution (check if this pattern may apply to other projects):
[ ] This looks like a gap in Agent OS itself — submit to evolution/PROPOSALS.md

---

INTERRUPTION COST

(Use the Severity Scoring Guide in AUTONOMY_METRICS.md if unsure.)

Estimated Time Lost: ___ minutes

Affected Backlog Items: (list IDs, e.g. BL-007, BL-013)

Workstream Impact:
[ ] Current task only
[ ] Current feature area
[ ] Multiple backlog items
[ ] Entire workstream

Future Impact:
[ ] No future impact
[ ] May affect future agents
[ ] Likely to recur
[ ] Guaranteed to recur without governance fix

Severity:
[ ] Low     (≤15 min, current task only, unlikely to recur)
[ ] Medium  (≤45 min, or current feature area, or may recur)
[ ] High    (>45 min, or multiple backlog items, or likely to recur)
[ ] Critical (>90 min, or entire workstream, or guaranteed to recur)

Reasoning: <one sentence explaining the severity choice>

---

Current State:

What was completed this session?

What remains incomplete?

---

Recommended Next Action:

What should happen next? (be specific — name the file, task ID, or decision needed)
```

**Stop Report Rules:**
- "Batch Objective Completed" is the only acceptable reason to stop without a governance recommendation or cost estimate.
- If the stop was avoidable, the governance improvement is not optional — write it out even if you cannot apply it yourself. The Governance role will apply it.
- Every Stop Report feeds both the Interruption Log below and the Cost Log in `AUTONOMY_METRICS.md`.
- The Governance role reads `AUTONOMY_METRICS.md` after every session to update category totals and reprioritise governance work.

---

## Verify Before Fixing — Required Rule

**Before implementing any fix from HANDOFF.md or BACKLOG.md, read the actual source file first.**

The fix documents are snapshots; code changes underneath them. If the issue no longer exists in the file, mark the item as pre-done in `BACKLOG.md` and move on. Do not implement a fix over working code.

---

## Green Zone — Act Without Asking

These are safe to do without confirmation. Replace the examples below with project-specific equivalents during bootstrap.

### Code changes
- Add new screens, components, or services following the established module pattern
- Fix type errors without changing behaviour
- Implement TODOs that are already documented in code comments or BACKLOG.md
- Wire navigation that is already described in types / route definitions
- Add error handling and empty-state UI
- Rename variables/functions within a single file for clarity
- Use any already-imported library or framework
- Investigate a type or schema file to determine if a feature is feasible (see Type Investigation Pattern)
- Mark a BACKLOG item as NO-OP after investigation, with a written reason

### Infrastructure reads
- Query or inspect any existing schema, table, or API to understand its structure
- Run lint / type-check commands
- Start the development server

---

## Yellow Zone — Proceed But Announce

Do these, but state what you're doing before you do it:

- Adding a new package / dependency (state the package and why)
- Creating a new database table or schema migration (describe the schema first)
- Changing navigation structure (route hierarchy, tab order)
- Removing an existing screen or feature
- Modifying build or config files (`app.config.ts`, `next.config.js`, etc.)
- Changing authentication configuration or token handling

---

## Red Zone — Always Ask First

Stop and ask the human before:

- Changing backend project credentials (URLs, API keys, project IDs)
- Pushing to git remote or creating a PR
- Running any cloud build or deployment command
- Running any SQL that mutates production data
- Deleting files that are not obviously dead code
- Changing auth session storage or token handling behaviour
- Introducing a second UI library or framework alongside the established one

---

## Recurring Patterns — Resolve Automatically

When these situations come up, use the documented resolution without asking. Add project-specific rows here during bootstrap.

| Situation | Resolution |
|---|---|
| BACKLOG item says something is broken | Read the actual source file first. If already fixed, mark DONE and move on. |
| BACKLOG item status is BLOCKED | Skip entirely. Do not attempt. Surface in Stop Report only. |
| Feature feasibility depends on a data field | Read the relevant type/schema file. Present: implement. Absent: NO-OP + note which field is missing. |
| Quick action / button has no destination screen | Leave `onPress: () => {}`. Do not create stub screens. Document as FUTURE in BACKLOG. |
| New module or domain area needed | Create standard folder structure: `{domain}/screens/`, `services/`, `types/`, `components/`, `index.ts` |
| Loading state needed | Use established loading component / spinner pattern from existing screens |
| Empty state needed | Centred view with icon, title text, and optional CTA button (follow existing examples) |
| Error state needed | Show error text in established error colour; offer retry action |

---

## Type Investigation Pattern

When a feature's feasibility depends on whether a data field or API property exists:

1. Read the relevant type definition or schema file
2. If the field is present → implement the feature
3. If the field is absent → mark item as NO-OP in `BACKLOG.md` with a note of which field is missing; leave the UI element in its current disabled/empty state
4. Do not ask the human — the type/schema is the source of truth for what data is available

---

## When to Stop and Surface to Human

- Type errors that cannot be resolved without changing the API contract of an existing service
- Authentication or permissions errors that should not be occurring
- A required feature depends on a module or library incompatible with the current runtime
- Two decisions in `DECISIONS.md` directly conflict for the current task
- A new feature is in the backlog as FUTURE with no existing scaffolding (build nothing without explicit scope)
- Infrastructure is unreachable (database paused, API down, etc.)

---

## Interruption Log

Track stop reasons here. When the same category appears twice, it must become a governance rule. Full cost data lives in `AUTONOMY_METRICS.md`.

| Date | Role | Stop Reason | Category | Min Lost | Severity | Governance Update |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
