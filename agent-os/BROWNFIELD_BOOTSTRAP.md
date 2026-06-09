# Brownfield Bootstrap Guide

Use this guide when dropping Agent OS into an **existing project** with code already written.

The challenge in a brownfield project is that agents need accurate context fast — but the codebase is a moving target and any document you write today can be stale tomorrow. The goal is to capture enough truth to enable autonomous execution, while building in the verify-before-fixing discipline that keeps stale docs from causing harm.

---

## What You'll Produce

- `VISION.md` — system topology, deployment targets, hard constraints (anti-hallucination)
- `CLAUDE.md` — accurate reflection of the existing architecture
- `DECISIONS.md` — decisions already embedded in the codebase (extracted)
- `PROJECT_STATE.md` — honest representation of what's working, broken, and pending
- `BACKLOG.md` — outstanding work from existing issue lists, TODOs, and known gaps
- `AUTONOMY.md` — zone rules configured for this project's risk profile
- `AUTONOMY_METRICS.md` — ready to track interruptions
- `HANDOFF.md` — current feature state
- `AGENT_REGISTRY.md` — active agent workforce registry

---

## Step 1 — Copy Templates

Copy all files from `agent-os/templates/` into the project root:

```
project-root/
├── VISION.md
├── CLAUDE.md
├── PROJECT_STATE.md
├── DECISIONS.md
├── AUTONOMY.md
├── BACKLOG.md
├── HANDOFF.md
├── AUTONOMY_METRICS.md
├── AGENT_REGISTRY.md
└── archive/
```

---

## Step 2A — Fill VISION.md (Interview-first)

**Run the human interview before the codebase audit.** This is intentional: the human's mental model must be captured before the code can contaminate or correct it.

**Phase 1 — Interview the human** (Part 1 of VISION.md):
Ask the 8 questions in `VISION.md §Part 1`. Record answers verbatim. If the human says something that seems wrong, write it down — that discrepancy is the most valuable output.

**Phase 2 — Audit the code** (Part 2 of VISION.md):
Run the codebase audit (Step 3 below). For each human answer, record what the code actually shows.

**Phase 3 — Reconcile** (Part 3 of VISION.md):
List every discrepancy. Tag each row: Aligned / Human ahead / Code ahead / Conflict. Conflicts are not failures — they are the system catching risk before agents act on wrong assumptions.

**Phase 4 — Human sign-off**:
The human reviews the reconciliation table and confirms or corrects before any agent writes code.

Key types of valuable conflicts this surfaces:
- Human believes a feature works → code shows it is a stub
- Human believes a constraint is enforced → code bypasses it
- Code implements behaviour the human didn't know existed

---

## Step 2B — Assign Roles and Register Agents (Governance role)

Decide how many agents will be active and which roles they hold.

1. Update `PROJECT_STATE.md §Active Agents`
2. Register each agent in `AGENT_REGISTRY.md` — model, roles, status, current task

In brownfield solo projects, one agent typically holds all roles. Governance responsibilities become especially important — stale documentation causes more harm here than in greenfield.

---

## Step 3 — Audit the Codebase (Governance role)

Perform a read-only audit before writing any document. Answer these questions:

### Architecture
- What is the top-level entry point?
- What framework and version?
- What does the folder structure look like?
- What are the key dependencies?
- What is the import / path alias convention?

### Backend / Data
- What database is in use? What ORM / client?
- What authentication approach?
- What external APIs does the app call?
- What environment variables are expected?

### Styling
- What UI library or styling approach?
- What is the established colour palette?
- What is the established card/button/loading pattern?

### Navigation / Routing
- What router is used?
- What is the authenticated vs. unauthenticated route structure?

### Existing Issues
```bash
# TODOs and FIXMEs
grep -r "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" --include="*.py"

# Stubs and placeholders
grep -r "throw new Error\|not implemented\|placeholder\|stub" src/

# Recent work
git log --oneline -20

# Existing issue lists
find . -name "*.md" | xargs grep -l "TODO\|BACKLOG\|ISSUE" 2>/dev/null | head -10
```

---

## Step 4 — Fill CLAUDE.md (Governance role)

Use the audit output to fill the CLAUDE.md template. Be conservative:
- Only document what you verified exists in the code
- Use `(inferred)` for anything not confirmed by reading a file
- If you find contradictions, note both and flag for human review

---

## Step 5 — Extract Existing Decisions (Architecture / Governance roles)

Decisions embedded in code are still decisions. Identify:

1. **Technology choices** already made and not easily reversible
2. **Architectural patterns** already established (module structure, data access, component hierarchy)
3. **Conventions** already in use (file naming, import style, state management)
4. **Known anti-patterns** (grep git log for "revert" or "remove")

Write each as a D-NNN entry in `DECISIONS.md` labelled `Source: codebase inference`.

Then share `DECISIONS.md` with the human for a quick review. They may correct inferences, add rationale, or mark some decisions as under review.

---

## Step 6 — Audit for Known Gaps (Governance role)

Translate all discovered issues into BACKLOG items. Group related items. Size each. Add the `Role:` tag.

---

## Step 7 — Assess Feature Status (Governance role)

For each major feature area:

1. Does the entry point / route exist?
2. Does the service / data layer exist and connect to the backend?
3. Does the UI render without crashing? (look for commented-out calls, `// TODO`, `throw new Error`)
4. Is there an obvious data dependency that may not be satisfied?

Write each finding into `HANDOFF.md §What Is Working` or `§Known Gaps`. Be conservative:
- "Confirmed working" — only if you read the code and see it is complete
- "Assumed working" — you can see the code but cannot run it
- "Unknown" — the code path is ambiguous
- "Broken/Incomplete" — clear placeholders or errors visible

---

## Step 8 — Fill PROJECT_STATE.md (Governance role)

With the audit done:

1. Write the project description (what the code actually does — not what was planned)
2. Feature status table — use HANDOFF.md findings
3. Active human actions — anything the human must do before agents can proceed
4. List top 3–5 BACKLOG items as next recommended actions
5. Architecture snapshot
6. Governance Health: Sessions = 0, everything else 0

---

## Step 9 — Configure AUTONOMY.md (Governance role + Human)

This is the most important brownfield step. Zone rules must reflect this project's actual risk profile.

**Ask the human**:
- What can an agent freely modify without review?
- What config files are sensitive?
- What production systems does this project touch?
- What credentials exist and where?
- What are the irreversible operations specific to this stack?

**Fill from the codebase audit**:
- What is the established pattern for a new screen / page / route?
- How are database queries made?
- What is the loading state pattern?
- What is the error state pattern?

---

## Step 10 — Human Review Checkpoint

Before any Feature Development sessions, give the human:

1. `CLAUDE.md` — verify the architecture description is accurate
2. `DECISIONS.md` — verify inferred decisions; add rationale where missing
3. `PROJECT_STATE.md` — verify feature status is honest
4. `BACKLOG.md` — verify priority; add missing items; mark FUTURE anything with no scope
5. `AUTONOMY.md` — verify zone rules are correct for this project

**Common human actions from this checkpoint**:
- Correct misidentified decisions
- Clarify scope on vague BACKLOG items
- Add Red Zone rules for production systems agents wouldn't know about
- Mark BACKLOG items BLOCKED that depend on external decisions

---

## Step 11 — First Feature Development Session

The Feature Development role reads `PROJECT_STATE.md` + `BACKLOG.md` and picks the first TODO item.

**Critical brownfield rule**: Verify every `HANDOFF.md` "broken" item against the actual source file before implementing a fix. The HANDOFF.md was written during audit and may already be out of date.

**Checkpoint after first session**:
- Did work stop unexpectedly? → Governance role processes Stop Report, adds rules
- Did any HANDOFF.md items turn out to be already fixed? → Update HANDOFF.md; add rule to `AUTONOMY.md` Recurring Patterns

---

## Brownfield Checklist

- [ ] Templates copied to project root
- [ ] Role assignments defined in `PROJECT_STATE.md §Active Agents`
- [ ] Codebase audit completed (architecture, dependencies, gaps, decisions)
- [ ] `CLAUDE.md` filled from audit
- [ ] `DECISIONS.md` has inferred decisions labelled `Source: codebase inference`
- [ ] Human has reviewed and corrected `DECISIONS.md`
- [ ] `BACKLOG.md` has outstanding work from TODOs, git log, and known gaps
- [ ] `HANDOFF.md` has honest feature status (Confirmed / Assumed / Unknown / Broken)
- [ ] `PROJECT_STATE.md` complete and human-reviewed
- [ ] `AUTONOMY.md` zone rules reviewed with human for this project's risk profile
- [ ] Recurring Patterns populated from codebase audit
- [ ] `archive/` folder created
- [ ] First session planned

---

## Common Brownfield Pitfalls

**Pitfall 1: Trusting existing documentation over code**
All documentation is potentially stale. Code is the source of truth. `HANDOFF.md` and `DECISIONS.md` are what you *discovered* in the code, not what was claimed in a README.

**Pitfall 2: Over-reaching in the audit**
Document what you read, not what you infer. "The pattern appears to be X" is fine. "The system does X" requires verification. Unverified claims in governance docs cause the Feature Development role to implement fixes for things that are already working.

**Pitfall 3: Setting zone rules too permissive**
In a brownfield project, there is almost always a production system or credential in play. Default the Red Zone to be more conservative, then relax it once the Feature Development role demonstrates correct behaviour.

**Pitfall 4: Writing BACKLOG items without acceptance criteria**
"Fix the login page" is not a BACKLOG item. "Login page: email input should not clear on failed attempt (see `src/screens/LoginScreen.tsx:47`)" is a BACKLOG item. The Feature Development role should be able to start and finish an item without asking a question.

**Pitfall 5: Skipping human review before first Feature Development session**
In a brownfield project, an agent implementing changes based on incorrect inferences can cause real damage. Get human sign-off on `PROJECT_STATE.md` and `AUTONOMY.md` before the first session.
