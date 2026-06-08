# Agent Roles

Agent OS is role-based, not letter-based. Roles define what an agent is responsible for and what authority it holds. Agent names (Claude, GPT-4o, Gemini, "Agent 1") are temporary session labels and carry no governance meaning.

A project assigns roles to agents. One agent can hold multiple roles. Multiple agents can share a role. A solo project might have one agent holding all roles.

---

## The Minimum Viable Configuration

Every project needs at least these three roles active. All other roles are optional.

| Role | Core responsibility |
|---|---|
| **Governance** | Project memory, stop report processing, context compaction, metrics |
| **Feature Development** | Code implementation within zone rules |
| **Product** | Requirements → structured backlog items |

In a solo-agent project, the same agent holds all three. The Governance role responsibilities still apply — they just happen in the same context window.

**Recommended addition** for any project past its first milestone:

| Role | Core responsibility |
|---|---|
| **Horizon** | Forward-looking decisions, architecture risk, freeflow idea stress-testing |

---

## Role Catalog

### Governance

**Purpose**: Maintain the project's operational memory so every session starts fast and every stop makes the next session smarter.

**Responsibilities**:
1. Keep `PROJECT_STATE.md` under 100 lines, always reflecting verified code state
2. Process Stop Reports: log in `AUTONOMY_METRICS.md`, apply governance fixes, update docs
3. Compact context: move completed history to `archive/` when active docs exceed ~150 lines
4. Pre-make decisions: read upcoming backlog items, encode predictable decisions in `DECISIONS.md`
5. Track interruption costs; escalate systemic issues to the human
6. Submit Agent OS evolution proposals when project experience reveals a generalizable improvement

**Authority**:
- Green: All governance files (`AUTONOMY.md`, `AUTONOMY_METRICS.md`, `PROJECT_STATE.md`, `DECISIONS.md`, `BACKLOG.md`, `HANDOFF.md`, `archive/`, `evolution/`)
- Yellow: `CLAUDE.md` (may need human review of architecture claims)
- Red: Source code — Governance never writes to `src/` or equivalent

**Post-session checklist**:
1. Add a row to `AUTONOMY_METRICS.md` for every Stop Report received
2. Apply any avoidable governance fix before the next session
3. Update `PROJECT_STATE.md` to reflect current state
4. Update `BACKLOG.md` item statuses
5. Add Autonomy Trend row
6. If any category: 3+ occurrences → escalate to human; >90 min total → escalate immediately

---

### Feature Development

**Purpose**: Implement backlog items autonomously within zone rules.

**Responsibilities**:
- Read `PROJECT_STATE.md` + `BACKLOG.md` to orient; pick top-most TODO item
- Work through items top-to-bottom, updating status inline
- Follow Green/Yellow/Red zone rules in `AUTONOMY.md`
- Verify source files before treating `HANDOFF.md` items as broken
- File a Stop Report whenever work pauses for any reason
- Update `HANDOFF.md` after completing each feature area

**Authority**:
- Green: All code changes defined in `AUTONOMY.md §Green Zone`
- Yellow: All actions in `AUTONOMY.md §Yellow Zone` — announce first, then proceed
- Red: All actions in `AUTONOMY.md §Red Zone` — stop and ask before proceeding

**Session start protocol**:
```
1. Read PROJECT_STATE.md
2. Read BACKLOG.md (active items only)
3. Pick top-most TODO
4. Start working
```
If you have read more than 2 files without starting a task, stop loading and begin work. Pull additional context on-demand only.

---

### Product

**Purpose**: Translate product requirements into structured, executable backlog items.

**Responsibilities**:
- Interview the human to understand feature requirements and acceptance criteria
- Write BACKLOG items with status, size estimate (S/M/L/XL), and clear acceptance criteria
- Break large features into independently shippable pieces
- Identify blockers, external dependencies, and missing information
- Mark items BLOCKED when a human decision is required before proceeding
- Tag `DECISIONS.md` entries with `[NEEDS HUMAN]` when a choice is the human's to make

**Authority**:
- Green: Write to `BACKLOG.md` and `HANDOFF.md`
- Yellow: Write to `DECISIONS.md` (tagging human-pending items)
- Red: Never implement code; never make architectural decisions unilaterally

**Backlog item sizing guide**:
| Size | What it is | Typical effort |
|---|---|---|
| S | One screen or component; no new dependencies | Under 2 hours |
| M | One module (2–4 screens + service layer) | ~4 hours |
| L | Full feature area (multi-screen, backend integration) | ~1 day |
| XL | Multiple coordinated features or architectural work | Multi-day |

---

### Horizon

**Purpose**: Think ahead of the current milestone — identify decisions that will be needed before agents hit them, stress-test ideas against actual code, and maintain the project's forward-looking context.

**Two modes**:
- **Milestone Mode** — Runs at the start of each milestone. Structured output. ~30–60 min.
- **Freeflow Mode** — Human-triggered at any time. Interactive. Human drops ideas; agent engages honestly, grounded in code.

**Responsibilities**:
- Complete the grounding step before any horizon thinking (see `workflows/horizon-review.md`)
- Pre-populate `DECISIONS.md` with decisions the next milestone will need
- Maintain `HORIZON.md`: open questions (with urgency tiers), ideas in flight, architecture risks
- Update `VISION.md` when product direction shifts
- Stress-test human ideas against actual code — honesty over agreement
- Surface architecture risks before they become Feature Development blockers

**Authority**:
- Green: Read all source code; write to `HORIZON.md`, `DECISIONS.md`, `VISION.md`
- Yellow: Propose additions to `AUTONOMY.md` based on horizon findings
- Red: Never implement code; never re-open a settled decision without evidence it's wrong; never write directly to `BACKLOG.md` (hand tasks to Product role)

**Session start protocol** (Milestone Mode):
```
1. Grounding step — read PROJECT_STATE.md, BACKLOG.md, DECISIONS.md, HORIZON.md, key arch files
2. Answer the five horizon questions (H1–H5) — see workflows/horizon-review.md
3. Write outputs: DECISIONS.md entries, HORIZON.md updates, VISION.md patches
4. File Stop Report
```

**Session start protocol** (Freeflow Mode):
```
1. Grounding step — same as above
2. Engage with human's ideas — challenge, stress-test, ask the right questions
3. Before ending: write crystallised outputs to HORIZON.md or DECISIONS.md
4. File Stop Report
```

Full protocol: `agent-os/workflows/horizon-review.md`

---

### Architecture

**Purpose**: Make and record high-level technical decisions that constrain implementation choices.

**Responsibilities**:
- Evaluate technical options and write decisions as D-NNN entries in `DECISIONS.md`
- Ensure new feature designs are consistent with existing decisions
- Flag when a proposed implementation conflicts with a settled decision
- Propose decision updates when evidence shows a decision is wrong

**Authority**:
- Green: Read all source code, write to `DECISIONS.md`
- Yellow: Propose additions to `AUTONOMY.md §Yellow Zone` or `§Red Zone`
- Red: Never implement code unilaterally; never override human-marked decisions

---

### Research

**Purpose**: Investigate options, feasibility, and external systems before implementation decisions are made.

**Responsibilities**:
- Spike on unknown technology, library, or API choices
- Produce time-boxed research reports (not open-ended exploration)
- Document findings in `DECISIONS.md` as candidate decisions for Architecture role review
- Define the scope of research before starting (to avoid open-ended spikes)

**Authority**:
- Green: Read source code, read external docs and APIs, write research summaries
- Yellow: Install temporary packages for evaluation (must be removed or promoted after)
- Red: Never commit research-phase code to the main implementation

---

### QA

**Purpose**: Test implementations against acceptance criteria; identify and document defects.

**Responsibilities**:
- Verify BACKLOG item acceptance criteria after Feature Development marks items DONE
- Write bug reports as new BACKLOG items with specific reproduction steps
- Distinguish product bugs (wrong behaviour) from technical debt (correct but fragile)
- Maintain a regression checklist for critical user paths

**Authority**:
- Green: Read all code, run all non-destructive test commands
- Yellow: Write to `BACKLOG.md` (new bug items), update `HANDOFF.md §Known Gaps`
- Red: Never modify source code; never deploy

---

### Data

**Purpose**: Manage database schemas, migrations, and data quality.

**Responsibilities**:
- Write migration SQL or schema files for new features
- Ensure migrations are idempotent (safe to re-run)
- Document new tables and fields in `HANDOFF.md §Schema Reference`
- Flag when application code calls tables or fields that don't exist

**Authority**:
- Green: Write schema files; read all tables
- Yellow: Write new migrations; describe schema changes before executing
- Red: Never run migrations against production without human confirmation

---

### Deployment

**Purpose**: Manage releases, CI/CD pipelines, and environment configuration.

**Responsibilities**:
- Manage build and deploy commands, pipeline configuration
- Ensure environment variables are documented
- Coordinate release branches and version tagging

**Authority**:
- Yellow: All CI/CD config changes — announce before modifying
- Red: Pushing to production; running cloud build commands; changing secrets

---

### Documentation

**Purpose**: Maintain user-facing and developer documentation in sync with the implementation.

**Responsibilities**:
- Update `CLAUDE.md` when architecture changes
- Write API and usage documentation for shipped features
- Flag documentation that is out of date with current code

**Authority**:
- Green: Write all documentation files (`CLAUDE.md`, `HANDOFF.md`, etc.)
- Yellow: Removing or significantly restructuring existing docs
- Red: Never modify source code to match documentation (fix the docs instead)

---

## Role Assignment

Projects declare their role assignments in `PROJECT_STATE.md §Active Agents`. Update this section at the start of each session.

```markdown
## Active Agents

| Agent | Role(s) | Current Focus |
|---|---|---|
| [Agent name or "This session"] | Feature Development | BL-001 through BL-005 |
| [Agent name or "This session"] | Governance | Process stop reports; update PROJECT_STATE.md |
```

For single-agent projects:
```markdown
## Active Agents

| Agent | Role(s) | Current Focus |
|---|---|---|
| This session | Feature Development, Governance, Product | Pick from top of BACKLOG.md |
```

---

## Escalation Rules

These apply regardless of how roles are distributed:

| Situation | Role responsible |
|---|---|
| Ambiguous product requirement | Product asks the human before writing the backlog item |
| Technical blocker in implementation | Feature Development stops with a Stop Report |
| New governance rule needed | Governance adds it to `AUTONOMY.md` |
| Architectural decision needed | Architecture writes a `[NEEDS HUMAN]` entry in `DECISIONS.md` |
| Same interruption category 3× | Governance escalates to human — root cause may be structural |
| Any category accumulates >90 min total | Governance escalates to human immediately |
| BLOCKED backlog item | Feature Development skips it entirely; surfaces in Stop Report only |
| Agent OS pattern failure (recurring cross-project) | Submit proposal to `evolution/PROPOSALS.md` |

---

## The Governance Role in Solo-Agent Projects

When one agent holds all roles, the Governance responsibilities are the easiest to skip — and the most important not to. A solo agent that skips Governance becomes an agent that restarts blind each session.

**Minimum Governance discipline for solo-agent projects**:
1. End every session with an updated `PROJECT_STATE.md`
2. File a Stop Report even when stopping alone (it becomes the next session's resume note)
3. After every 3 stops of the same category, add a governance rule before continuing
