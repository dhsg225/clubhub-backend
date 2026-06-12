# Autonomy Rules — What Agents Can Do Without Asking

This file defines the thresholds for autonomous action vs. human check-in for **ClubHub TV**.

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
- `CLAUDE.md` — only when you need a convention (architecture pattern, env var, etc.)

**Tier 3 — Never read on cold start:**
- `AUTONOMY.md` — you are reading it now; do not re-read next session unless a zone question arises
- `AUTONOMY_METRICS.md` — Governance role only

**Rule**: If you have read more than 2 files without starting a task, stop loading files and start working.

**Context Pressure Rule** (added 2026-06-09 — FD-2 stop report): At 80% context, finish the current atomic unit of work (one function, one test) then file a Stop Report immediately. Do not start a new file read, new route, or backlog update at >80% context. Bookkeeping writes (BACKLOG.md, PROJECT_STATE.md) are the first thing to drop — describe what's incomplete in the Stop Report instead.

**Spec Doc Pre-Read Exemption** (added 2026-06-09 — CH3 stop report): If the AGENT_REGISTRY.md task description lists exact fields, files, and acceptance criteria, skip the referenced spec doc pre-reads. Read spec docs only when the task description says "design decision" or "consult spec" — not when it just names them as background. A self-contained AGENT_REGISTRY.md entry is sufficient to implement from.

---

## Governance Role — Responsibilities

1. **Project Memory** — `PROJECT_STATE.md` kept current and ≤100 lines after every session
2. **Context Compression** — active docs stay lean; completed detail moves to `archive/`
3. **Autonomy Improvement** — `AUTONOMY_METRICS.md` updated after every session
4. **Project State Management** — `HANDOFF.md` and `BACKLOG.md` reflect verified code state

**Context Compaction Rule**: When any active document exceeds ~150 lines of completed/historical content, compress it. Move build specs to `archive/BACKLOG_ARCHIVE.md`. Keep only summaries in active docs.

---

## MANDATORY STOP PROCEDURE

Whenever work pauses for **any reason**, produce a Stop Report before handing back to the human.

```
STOP REPORT

Stopped by: [role]

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

Description:
What specifically caused the stop?

Could this have been avoided?
YES / NO
If YES — what governance change would have prevented it?

Recommended Governance Improvement:
[ ] DECISIONS.md  — decision that should have been pre-made
[ ] AUTONOMY.md   — rule or pattern that should have existed
[ ] CLAUDE.md     — context or convention that was missing
[ ] BACKLOG.md    — task spec that was too vague
[ ] HANDOFF.md    — state that was stale or missing

INTERRUPTION COST
Estimated Time Lost: ___ minutes
Affected Backlog Items:
Workstream Impact:
[ ] Current task only  [ ] Current feature area  [ ] Multiple backlog items  [ ] Entire workstream
Severity:
[ ] Low (≤15 min)  [ ] Medium (≤45 min)  [ ] High (>45 min)  [ ] Critical (>90 min)
Reasoning:

Current State:
What was completed? What remains incomplete?

Recommended Next Action:
```

---

## Verify Before Fixing — Required Rule

**Before implementing any fix from `HANDOFF.md` or `BACKLOG.md`, read the actual source file first.**

If the issue no longer exists, mark the item DONE/NO-OP and move on. Do not implement a fix over working code.

---

## Zone Rules — Setup Guidance

**Primary goal of zone rules is to reduce agent interruptions (MTBI).** Vague or generic rules cause agents to stop and ask when they shouldn't — or worse, to act when they shouldn't.

When reviewing or updating these sections:
- Every rule should be specific to this project's actual stack — not a generic default
- Each Red Zone rule must name the specific failure mode it prevents
- Each Green Zone permission must be confirmed as unable to touch production data or credentials

---

## Green Zone — Act Without Asking

### Code changes
- Add new Express routes following the established pattern (`routes/*.js`, with rate limit, via `index.js`)
- Fix TypeScript type errors without changing behaviour
- Implement BACKLOG items already in TODO status
- Add new test suites or contract checks (do not modify existing checks — see Red Zone)
- Add error handling and empty-state UI in Studio components
- Rename variables/functions within a single file for clarity
- Investigate any type, schema, or source file to determine feasibility
- Mark a BACKLOG item as NO-OP after investigation, with a written reason
- Run `node test-runner/contracts/validate-contracts.js` to verify contract state
- Run integration test harness (`docker compose -f docker-compose.integration.yml up`)

### Infrastructure reads
- Query or inspect any existing schema, table, or API to understand its structure
- Run lint / type-check commands
- Read any file in the codebase

---

## Yellow Zone — Proceed But Announce

State what you're doing before you do it:

- Adding a new npm/pnpm package (state the package and why)
- Creating a new database migration (`backend/db/migrate_00N.sql` — describe schema first)
- Modifying rate limit thresholds in `rateLimiter.js`
- Changing navigation structure in Studio (adding a new tab)
- Modifying `docker-compose.dev.yml` or `docker-compose.integration.yml`
- Adding a new governance check to `validate-contracts.js` (additive only — do not modify existing)
- Changing the Studio component structure or adding a new component

---

## Red Zone — Always Ask First

Stop and ask the human before:

- Modifying **any Frozen Map module** (see `CLAUDE.md §FROZEN MAP`):
  - `operator-ledger.js`, `distributed-authority.js`, `fleet-consensus.js`
  - `incident-orchestrator.js`, `governed-config.js`, `event-lineage.js`
  - `pre-engine.ts`, `state-machine.ts`, `corpus.ts`
  - `validate-contracts.js`, `governance-kernel/`, `backend/db/*.sql`
- Committing changes to any Frozen Map module without the contract gate passing
- Pushing to any git remote or creating a PR
- Running any migration against a production or shared database
- Deleting files outside of clearly dead code (confirmed unused by grep)
- Changing `SCREEN_AUTH_ENFORCE` to `false` in any staging or production env
- Modifying the append or hash-chain logic in `operator-ledger.js`
- Introducing a second UI framework alongside the existing React/plain-CSS pattern
- Modifying `docker-compose.production.yml`
- Changing the `autonomous_window_ms` constant in `player-runtime/src/index.ts` (constitutional floor)

---

## Port Conflicts — Check Before Starting Anything Local

Before running any local dev server, test runner, or docker compose: check `PORT_ALLOCATION_STANDARD.md`. Port 3000 is reserved. api-gateway is on 3100. Port 3001 conflicts between cms-api and player-runtime UiServer — read the doc.

```bash
lsof -ti:3001 | xargs kill   # clear the known conflict port before local test runs
```

## Recurring Patterns — Resolve Automatically

| Situation | Resolution |
|---|---|
| BACKLOG item says something is broken | Read the actual source file first. If already fixed, mark DONE and move on. |
| BACKLOG item is BLOCKED | Skip entirely. Do not attempt. Surface in Stop Report only. |
| Feature feasibility depends on a data field | Read the relevant type/schema file. Field present → implement. Absent → NO-OP + note missing field. |
| Need to read a threshold value | Use `getThreshold()` from `governed-config.js`. Never read `thresholds.json` directly. |
| New governance state mutation needed | Check if an advisory-lock primitive exists for that operation. If not, surface to human before implementing. |
| New backend route needed | Follow pattern: create `routes/foo.js`, add rate-limited `app.use('/foo', rateLimit.write, fooRouter)` in `index.js`. |
| New Studio tab needed | Add to `Tab` type in `App.tsx`, add nav button, add conditional render. No router needed. |
| Corpus replay verification needed | Run `pnpm verify:g1:corpus` (or full suite `pnpm verify:pure`). |
| Contract gate failing on a non-Frozen file | Fix the violation. Contract checks are non-negotiable. |

---

## Type Investigation Pattern

When a feature's feasibility depends on whether a data field or API property exists:

1. Read the relevant type definition or schema file
2. Field present → implement
3. Field absent → mark item NO-OP in `BACKLOG.md` with a note of which field is missing
4. Do not ask the human — the type/schema is the source of truth

---

## When to Stop and Surface to Human

- Any change would touch a Frozen Map module
- Type errors that require changing an existing API contract
- A governance invariant would be weakened (e.g., removing a throw, weakening a check)
- Two entries in `DECISIONS.md` conflict for the current task
- A BACKLOG item is marked BLOCKED — skip and report
- The contract gate fails after a change and the fix is not obvious
- Infrastructure is unreachable (database paused, API down)

---

## Interruption Log

| Date | Role | Stop Reason | Category | Min Lost | Severity | Governance Update |
|---|---|---|---|---|---|---|
| 2026-06-09 | QA (CH1) | Batch Objective Completed | BL-INT-01 | 0 | Low | None |
| 2026-06-09 | Feature Development (CH2) | Batch Objective Completed | BL-011 | 0 | Low | None |
| 2026-06-09 | Feature Development (CH3) | Context Window Pressure | BL-012 | 5 | Low | Spec Doc Pre-Read Exemption added to RESUME PROTOCOL |
