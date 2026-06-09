# [Project Name] — Agent Reference

## What This Is

[One sentence: what the product does and who it's for.]

## Runtime & Build

- **Framework**: [e.g. Next.js 14, Expo SDK 54, Rails 7]
- **Language**: [e.g. TypeScript, Ruby, Python]
- **Run**: `[command]`
- **Test**: `[command]`
- **Build**: `[command]`

## Key Dependencies

| Package | Version | Role |
|---|---|---|
| [package] | [version] | [what it does] |

## Path Aliases / Import Conventions

```
[alias] → [path]
```

## Project Structure

```
[ASCII tree of the main directories and files.
Focus on the files agents will touch most often.
~30 lines max.]
```

## Backend / Data Sources

### [Service name]
- **URL**: `[endpoint]`
- **Auth**: [how auth works]
- **Tables / endpoints used**: [list]

## Styling Conventions

- **Primary colour**: `[hex]`
- **Background**: `[hex]`
- **Error colour**: `[hex]`
- **Text primary**: `[hex]`
- **Text secondary**: `[hex]`
- **Border**: `[hex]`
- **Card radius**: `[value]`
- **Styling approach**: [e.g. Tailwind, StyleSheet.create, CSS Modules — when to use each]

## Navigation Patterns

[Describe the routing / navigation structure. How do authenticated vs. unauthenticated routes work? What's the hierarchy?]

## State Management

[Global state: how it works, where it lives, how agents should interact with it.]

## Environment Variables

```
[VAR_NAME]=description
[VAR_NAME]=description
```

## Known Lint / Type Issues

[Any intentional suppressions or known issues agents should not "fix".]

## Running the App

```bash
[primary dev command]
[alternative / clear cache command]
```

---

## Horizon Role — Freeflow Mode

To run a freeflow Horizon session (think out loud about architecture, product direction, or future plans):

1. Agent reads `PROJECT_STATE.md`, `BACKLOG.md`, `DECISIONS.md`, `HORIZON.md`, and key arch files before engaging
2. Agent stress-tests ideas against the actual code — honesty over agreement
3. Before ending: any crystallised thought goes to `HORIZON.md` or `DECISIONS.md`
4. File a Stop Report

Full protocol: `agent-os/workflows/horizon-review.md`
Open questions and ideas in flight: `agent-os/HORIZON.md`

---

## MANDATORY STOP PROCEDURE

**Every session end — no exceptions — must produce a Stop Report.** This applies to clean completions too.

```
STOP REPORT

Stopped by: [role — e.g. Feature Development, QA, Governance]

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

Could this have been avoided? YES / NO
If YES — Recommended Governance Improvement:
  [ ] DECISIONS.md  — decision that should have been pre-made
  [ ] AUTONOMY.md   — rule or pattern that should have existed
  [ ] CLAUDE.md     — context or convention that was missing
  [ ] BACKLOG.md    — task spec that was too vague
  [ ] HANDOFF.md    — state that was stale or missing
  [ ] evolution/PROPOSALS.md — Agent OS gap, not a project gap

INTERRUPTION COST
Estimated Time Lost: ___ minutes
Affected Backlog Items: [IDs]
Workstream Impact: [ ] Current task only / feature area / multiple items / entire workstream
Severity: [ ] Low (≤15 min) / Medium (≤45 min) / High (>45 min) / Critical (>90 min)
Reasoning: <one sentence>

Current State:
What was completed this session?
What remains incomplete?

Recommended Next Action:
[specific — name the file, task ID, or decision needed]
```

**After filing the Stop Report**, the Governance role must:
1. Add a row to the Interruption Log in `AUTONOMY.md`
2. Update `PROJECT_STATE.md` to reflect completed/pending work
3. Update `BACKLOG.md` — mark completed items DONE
4. Apply any governance fix immediately (do not queue for later)

Full severity guide and workflow details: `agent-os/workflows/stop-report.md`

<!--
INSTRUCTIONS FOR AGENT C:

Keep this file architecture-focused, not task-focused.
Do not add task progress, feature state, or BACKLOG content here.
This file answers "how does this project work" — not "what are we building next."
Update when the architecture changes (new package, new pattern, new convention).
The Horizon freeflow and MANDATORY STOP PROCEDURE sections above must remain — do not remove them.
Do not exceed ~150 lines for the architecture content above those sections.
-->
