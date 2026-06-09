# Greenfield Bootstrap Guide

Use this guide when starting a **new project** with Agent OS from scratch.

---

## What You'll Produce

By the end of this guide:
- `VISION.md` — system topology, deployment targets, hard constraints (anti-hallucination)
- `CLAUDE.md` — project architecture and conventions
- `PROJECT_STATE.md` — project description and initial feature status
- `DECISIONS.md` — first batch of architectural decisions
- `BACKLOG.md` — first milestone's tasks, sized and prioritised
- `AUTONOMY.md` — zone rules configured for this project
- `AUTONOMY_METRICS.md` — ready to track interruptions
- `HANDOFF.md` — initial feature state snapshot
- `AGENT_REGISTRY.md` — active agent workforce registry
- `archive/` — empty folder for future context compaction

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
└── archive/           (create empty)
```

---

## Step 2A — Fill VISION.md (Interview-first)

**Run the human interview before touching any code.** Do not read the codebase first — the point is to capture the human's uncontaminated mental model, then compare it against reality.

**Phase 1 — Interview the human** (Part 1 of VISION.md):
Ask the 8 questions in `VISION.md §Part 1`. Record answers verbatim. Do not interpret, correct, or redirect. If the human says something that seems wrong, write it down anyway — that discrepancy is valuable data.

**Phase 2 — Audit the code** (Part 2 of VISION.md):
Now read the codebase. For each human answer, record what the code actually shows.

**Phase 3 — Reconcile** (Part 3 of VISION.md):
List every discrepancy. Tag each as Aligned / Human ahead / Code ahead / Conflict. For each Conflict, determine the action: update DECISIONS.md, update BACKLOG.md, fix code, or clarify with human.

**Phase 4 — Human sign-off**:
Give the reconciliation table to the human. They confirm or correct before any code is written.

A VISION.md with "Unknown — ask human" in specific cells is correct. A VISION.md with confident wrong claims is harmful. Conflicts are not failures — they are the system working.

---

## Step 2B — Assign Roles and Register Agents (Governance role)

Decide how many agents will be active and which roles they will hold.

1. Update `PROJECT_STATE.md §Active Agents` with the assignment
2. Register each agent in `AGENT_REGISTRY.md` with model, roles, and status

For solo projects:
```
| This session | Feature Development, Governance, Product | Pick from top of BACKLOG.md |
```

For multi-agent projects, decide which agent holds which role before writing any governance documents — the role determines authority boundaries and file ownership.

---

## Step 3 — Fill CLAUDE.md (Product + Governance roles)

Answer these questions by reading the scaffold or asking the human:

1. What does the project do? (one sentence)
2. Who is it for? (one sentence)
3. What framework and language?
4. How do you start the dev server?
5. What are the key packages? (even if versions are TBD)
6. What does the intended folder structure look like?
7. What's the backend? (database, auth, APIs)
8. What are the styling conventions? (colour palette, spacing, component library)
9. What are the environment variables?

The Governance role fills what it can; the human fills the rest.

---

## Step 4 — Record Initial Decisions (Architecture / Governance roles)

Before any code is written, the human should answer these foundational questions. The Architecture or Governance role writes each answer as a D-NNN entry in `DECISIONS.md`:

1. Primary language and framework
2. Authentication approach (Supabase, Auth.js, Clerk, etc.)
3. Database (Postgres, SQLite, Firestore, etc.)
4. UI component library, if any
5. Deployment target
6. Any hard constraints (must use X, must not use Y)

Every "we've decided to use X" becomes a decision record immediately. Label source as `Source: human input` or `Source: inferred from scaffold`.

---

## Step 5 — Write the First Backlog (Product role)

The Product role interviews the human to understand the first milestone:

1. What is the MVP? (minimum that makes this useful to one person)
2. What are the first 3–5 features? (one sentence each)
3. What are the acceptance criteria? (how will you know each is done)
4. What are the dependencies? (external APIs, design assets, third-party services)
5. What are the unknowns? (features where you're not sure how to build them)

Write one BACKLOG item per feature. Size each item (S/M/L/XL). Add the `Role:` tag. Order by priority.

**Sizing guide**:
- S: One screen or component. No new dependencies. Under 2 hours.
- M: One module (2–4 screens + service layer). ~4 hours.
- L: Full feature area (multi-screen, backend integration). ~1 day.
- XL: Multiple coordinated features or architectural work. Multi-day.

---

## Step 6 — Configure AUTONOMY.md (Governance role)

Replace the placeholder zone entries with project-specific content:

**Green Zone additions** — What can the Feature Development role do freely?
- What pattern should new modules follow? (folder structure, naming)
- What libraries are approved? (list them so agents don't ask each time)
- What are the safe read operations? (database reads, API GETs)

**Yellow Zone additions** — What needs announcement but not approval?
- Which config files are sensitive in this project?
- Which dependencies would be costly to add or remove?

**Red Zone additions** — What must always be approved?
- Which credentials are in play?
- Which production systems must not be mutated by agents?

**Recurring Patterns** — Add project-specific rows:
- What is the established pattern for loading state?
- What is the established pattern for error handling?
- What is the standard folder structure for a new feature?

---

## Step 7 — Fill PROJECT_STATE.md (Governance role)

With CLAUDE.md and BACKLOG.md done:

1. Write the one-paragraph project description
2. Set all features to 📋 Planned
3. List the first 3 backlog items as "Next Recommended Actions"
4. Add the architecture snapshot (copy the folder structure from CLAUDE.md)
5. Set Governance Health to all zeros

---

## Step 8 — First Feature Development Session

The Feature Development role reads `PROJECT_STATE.md` + `BACKLOG.md` and picks the first TODO item.

**Checkpoint after first session**:
- Did work stop for any reason besides "Batch Objective Completed"?
- If yes: the Governance role processes the Stop Report and adds governance rules before session 2.
- If no: proceed to session 2.

---

## Ongoing: The Governance Loop

After each session:

1. The stopping role files a Stop Report (or "Batch Objective Completed")
2. The Governance role processes the Stop Report → adds rules → updates `PROJECT_STATE.md` + `BACKLOG.md`
3. Human reviews `PROJECT_STATE.md` before next session
4. Next session starts from `PROJECT_STATE.md` + `BACKLOG.md` only

**Target**: By session 3, Feature Development runs a full session without interruptions.

---

## Greenfield Checklist

- [ ] Templates copied to project root
- [ ] Role assignments defined in `PROJECT_STATE.md §Active Agents`
- [ ] `CLAUDE.md` filled (framework, packages, structure, conventions)
- [ ] `DECISIONS.md` has D-001 through D-00N (foundational choices)
- [ ] `BACKLOG.md` has first milestone items, sized and ordered
- [ ] `AUTONOMY.md` Green/Yellow/Red zones have project-specific entries
- [ ] `AUTONOMY.md` Recurring Patterns table populated
- [ ] `PROJECT_STATE.md` complete
- [ ] `archive/` folder created
- [ ] First session can start from 2 files
