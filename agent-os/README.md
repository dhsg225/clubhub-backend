# Agent OS — v2.4.0

A lightweight governance system for AI-assisted software projects. Drop the templates into any project root to give agents structured context, autonomous decision authority, and a self-improving interruption reduction loop.

**Version**: 2.4.0 | **Changelog**: `evolution/CHANGELOG.md`

---

## The Core Problem It Solves

Without governance, every new agent session restarts from scratch: re-reading the codebase, re-asking questions already answered, re-litigating decisions already made, and stopping on problems that a simple rule would have resolved. The result is constant human interruptions and most of the context window spent on orientation rather than work.

Agent OS solves this with five documents that persist across sessions and a dedicated **Governance role** whose only job is keeping them accurate and lean.

---

## How It Works

```
Human defines work
      ↓
[Product role] structures it into BACKLOG.md
      ↓
[Feature Development role] executes it, filing Stop Reports when blocked
      ↓
[Governance role] processes Stop Reports → adds rules → updates PROJECT_STATE.md
      ↓
Next session: reads 2 files and starts working immediately
```

The loop works with 1 agent holding all roles, or 20 agents each holding one. **Roles are the durable concept; agent names are temporary session labels.**

---

## Roles

Agent OS is role-based, not agent-letter-based. Any number of agents can be used; each is assigned one or more roles.

| Role | Core Responsibility |
|---|---|
| **Governance** | Project memory, stop report processing, context compaction, metrics |
| **Feature Development** | Code implementation within zone rules |
| **Product** | Requirements → structured backlog items |
| **Architecture** | High-level technical decisions |
| **Research** | Feasibility spikes before implementation decisions |
| **QA** | Test against acceptance criteria; document defects |
| **Data** | Schemas, migrations, data quality |
| **Deployment** | CI/CD, environments, releases |
| **Documentation** | Keep docs in sync with implementation |

**Minimum viable project**: Governance + Feature Development + Product (can all be the same agent).

See `AGENT_ROLES.md` for full definitions, authority boundaries, and solo-agent guidance.

---

## Document Map

| File | Maintained by | Purpose |
|---|---|---|
| `VISION.md` | Human + Governance | System topology, deployment targets, hard constraints — anti-hallucination anchor |
| `AGENT_REGISTRY.md` | All agents | Active agent workforce — roles, status, task assignments, handoff state |
| `PROJECT_STATE.md` | Governance | Single entry point — always current, always ≤100 lines |
| `DECISIONS.md` | Architecture / Governance | Permanent record of architectural decisions |
| `AUTONOMY.md` | Governance | Zone rules, stop report template, recurring patterns |
| `BACKLOG.md` | Product / Feature Development | Task list with status, size, and context cost |
| `HANDOFF.md` | Feature Development | Implementation state snapshot |
| `AUTONOMY_METRICS.md` | Governance | Interruption cost tracking and governance priority queue |
| `CLAUDE.md` | Human / Documentation | Project architecture and convention reference |
| `reviews/` | Governance | External evaluation intake — immutable per-review files, triaged into standard docs |

---

## Getting Started

- **New project** → `GREENFIELD_BOOTSTRAP.md`
- **Existing project** → `BROWNFIELD_BOOTSTRAP.md`
- **Template files** → `templates/`
- **Role definitions** → `AGENT_ROLES.md`
- **Workflow definitions** → `workflows/`
- **External review intake** → `workflows/external-review-intake.md`
- **Agent OS evolution** → `evolution/`

---

## The Evolution System

Projects using Agent OS can feed improvements back. When a project's Governance role identifies a pattern that should generalise to all projects, it submits a proposal to `evolution/PROPOSALS.md`. Proposals go through a lightweight review cycle and, if accepted, are applied to the templates and recorded in `evolution/CHANGELOG.md`.

This is how Agent OS gets smarter over time. See `evolution/PROPOSALS.md` for the proposal format and `workflows/periodic-review.md` for when and how to run a review.

---

## Keeping Project Instances Up to Date

Each project has its own `agent-os/` directory with two kinds of files:

| Kind | Examples | Rule |
|---|---|---|
| **OS infrastructure** | Bootstrap guides, `AGENT_ROLES.md`, `README.md`, `templates/`, `workflows/`, `evolution/CHANGELOG.md` | Safe to overwrite from master on any version bump |
| **Project-specific** | `VISION.md`, `CLAUDE.md`, `PROJECT_STATE.md`, `DECISIONS.md`, `AUTONOMY.md`, `BACKLOG.md`, `HANDOFF.md`, `AUTONOMY_METRICS.md`, `AGENT_REGISTRY.md`, `evolution/PROPOSALS.md` | Never sync — these contain project content |

**When to sync**: Whenever master Agent OS gets a version bump.

**How to sync** (replace `<project-path>` with the target project root):

```bash
MASTER=/Users/admin/Dropbox/Development/agent-os
PROJECT=<project-path>/agent-os

cp $MASTER/BROWNFIELD_BOOTSTRAP.md $PROJECT/
cp $MASTER/GREENFIELD_BOOTSTRAP.md $PROJECT/
cp $MASTER/AGENT_ROLES.md $PROJECT/
cp $MASTER/README.md $PROJECT/
rsync -a $MASTER/templates/ $PROJECT/templates/
rsync -a $MASTER/workflows/ $PROJECT/workflows/
cp $MASTER/evolution/CHANGELOG.md $PROJECT/evolution/
```

Note: `evolution/PROPOSALS.md` is intentionally excluded — each project maintains its own proposals independently of the master.

**After syncing**: Check `evolution/CHANGELOG.md` for the latest version entry to understand what changed and whether any project-specific files need manual review (e.g. a CHANGELOG entry that says "update your AGENT_REGISTRY.md" means the project-specific file may also benefit from the change).

---

## Design Principles

1. **Two-file cold start**: An agent should reach productive context reading only `PROJECT_STATE.md` + `BACKLOG.md`.
2. **Governance from interruptions**: Every stop that could have been a rule *becomes* a rule. Stops get cheaper over time.
3. **Context is a resource**: Active documents stay lean. Completed history moves to `archive/`. Rules, not prose.
4. **Decisions are pre-made**: Frequent decision points get encoded in `DECISIONS.md` so agents never ask the same question twice.
5. **Zones, not lists**: Green/Yellow/Red authority zones scale to any project. Recurring patterns handle the specifics.
6. **Roles, not letters**: Agent identity is ephemeral. Roles are the durable governance unit.
7. **Evidence-driven evolution**: Agent OS improves based on real interruption data, not theory.
