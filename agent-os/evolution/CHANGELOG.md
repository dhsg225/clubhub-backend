# Agent OS — Changelog

Tracks all changes to Agent OS templates, workflows, and role definitions. Version numbers follow semantic versioning: MAJOR.MINOR.PATCH.

- **MAJOR**: Breaking changes to the role model, document structure, or workflow contracts
- **MINOR**: New files, new roles, new workflow steps (additive, non-breaking)
- **PATCH**: Clarifications, typo fixes, examples, template wording improvements

---

## v2.4.0 — 2026-06-08

### New: Horizon Role — freeflow and milestone thinking mode

**Summary**: Added a Horizon role and supporting infrastructure for structured product/architecture thinking. Two modes: Milestone Mode (structured, runs before each milestone) and Freeflow Mode (interactive, human-triggered). Both write to the same three outputs: `HORIZON.md`, `DECISIONS.md`, `VISION.md`.

**New files**:
- `templates/HORIZON.md` — working surface for open questions (urgency-tiered: 🔴/🟡/🔵), ideas in flight, architecture risks, session log
- `workflows/horizon-review.md` — full Horizon role protocol: grounding step, Milestone Mode (5 horizon questions), Freeflow Mode (stress-test protocol), output targets

**Key design rules**:
- Grounding step is mandatory before any horizon thinking — agent reads PROJECT_STATE.md, BACKLOG.md, DECISIONS.md, HORIZON.md, and key arch files before engaging
- Horizon agent stress-tests ideas, does not agree to be helpful
- Does not write to BACKLOG.md directly — hands resolved questions to Product role for backlog items
- Files a Stop Report after every session (clean completion included)

**Fix also included** (v2.4.0): Grounding Step in `workflows/horizon-review.md` previously had project-specific file paths hardcoded (from autosales). Replaced with generic instruction: "skim key architecture files relevant to the question at hand (check CLAUDE.md §Project Structure)."

**Updated files**:
- `README.md` — version bumped to v2.4.0

---

## v2.3.0 — 2026-06-08

### New: External review intake system

**Problem**: External evaluations (AI audits, human consultants, automated reports) had no defined home in Agent OS. Options were: dump into BACKLOG.md (loses source fidelity), keep in a separate file agents must remember to check (creates a parallel governance track that drifts), or ignore (invisible debt).

**Solution**: Three-layer intake model:
1. **Intake** — immutable per-review file in `reviews/YYYY-MM-DD-source-scope.md`
2. **Triage** — Governance role maps each finding to exactly one destination (VISION.md, DECISIONS.md, BACKLOG.md, or explicit discard with written reason)
3. **Absorption** — all signal lives in standard governance docs; the review file becomes archival

**Key design principles**:
- External feedback is input, not authority — Governance role has veto power over all findings
- Discard is a valid and explicit outcome — must include a written reason
- After triage, Feature Development agents never read review files — the two-file cold start is preserved
- `Superseded-by` field handles stale reviews when a newer evaluation covers the same scope
- Post-sign-off topology findings go to DECISIONS.md, not VISION.md Part 3

**New files**:
- `templates/EXTERNAL_REVIEW.md` — structured intake format with findings table, governance decision column, triage-complete footer, Status and Superseded-by fields
- `workflows/external-review-intake.md` — triage criteria, authority rules, triage authority table, anti-patterns

**Updated files**:
- `templates/BACKLOG.md` — `Source:` tag added to item template (optional, used when item originated from an external review)
- `templates/VISION.md` — instructions clarify that Part 3 rows can come from external reviews, but only pre-sign-off; post-sign-off topology corrections go to DECISIONS.md
- `README.md` — `reviews/` added to document map; `workflows/external-review-intake.md` added to Getting Started; version bumped to v2.3.0

**Source**: Proposed by a Claude instance during autosales brownfield bootstrap preparation (2026-06-08).

---

## v2.2.0 — 2026-06-08

### Fix: Cross-agent prompting is an injection surface, not a coordination mechanism

**Problem**: The `AGENT_REGISTRY.md` template implicitly modelled agents as having persistent, compellable identities across sessions. The instructions implied that one agent could write a governance-framed prompt to another agent to trigger self-registration or state disclosure. In practice, this is structurally identical to a prompt injection attack — and Claude agents correctly refuse it.

**Root cause**: AI agents have no persistent cross-session identity. Each session starts cold with no way to authenticate who sent a message. Any prompt that claims governance authority ("GOVERNANCE DIRECTIVE", "you are required to respond") will be flagged as injection by the receiving agent — because it is injection-shaped, regardless of intent.

**Discovered via**: Live incident in the ClubHub Player project. One session wrote a roll-call prompt; a second session refused it, correctly diagnosed the injection pattern, and self-corrected.

**Fix**:
- Added a "Multi-Agent Coordination Reality" section to `templates/AGENT_REGISTRY.md` explaining why cross-agent directives don't work
- Clarified that the human is the coordinator between sessions: ask agents in plain language, use `git diff` as the authoritative record, paste findings into the registry yourself
- Self-registration (each agent registers its own session) remains correct and is still required
- Added a WARNING to the instructions comment: do not write governance-framed prompts to other agents

**Key distinction preserved**: An agent self-registering its own session = valid. An agent being compelled to register by another agent's prompt = injection surface. The template now makes this distinction explicit.

**Updated files**:
- `templates/AGENT_REGISTRY.md` — new "Multi-Agent Coordination Reality" section; updated instructions warning

---

## v2.1.1 — 2026-06-08

### Fix: VISION.md is an interview protocol, not a fill-in form

**Problem**: The original v2.1.0 VISION.md template was structured as a document to fill in, not a structured human interrogation. Agents would infer answers from the codebase rather than capturing the human's actual mental model first. This defeats the core purpose — surfacing misalignments between human belief and code reality.

**Fix**: VISION.md restructured into 4 explicit phases:
1. **Human Interview** — 8 questions; record verbatim before touching the codebase
2. **Codebase Verification** — audit answers against actual code
3. **Reconciliation table** — every discrepancy tagged (Aligned / Human ahead / Code ahead / Conflict) with a required action
4. **Confirmed Topology** — the distilled truth after reconciliation

**Rule added**: No agent writes production code until the Reconciliation section is complete and human-signed.

**Key insight**: A Conflict row is not a failure — it is the system catching risk before agents act on wrong assumptions. The interview must run *before* the audit so the human's mental model is not contaminated by what the code says.

**Updated files**:
- `templates/VISION.md` — full restructure into 4-phase interview+reconcile format
- `GREENFIELD_BOOTSTRAP.md` — Step 2A now describes all 4 phases explicitly
- `BROWNFIELD_BOOTSTRAP.md` — Step 2A now describes all 4 phases; notes interview-before-audit order

---

## v2.1.0 — 2026-06-08

### New: VISION.md — System topology anchor

**Summary**: Added `VISION.md` as a required bootstrap artifact. Forces human+agent to explicitly document system topology, deployment targets, integration contracts, user personas, hard constraints, and anti-hallucination notes before any code is written. Prevents agents from making wrong assumptions about what kind of system they're building for.

**New files**:
- `templates/VISION.md` — template with sections: System Topology, User Personas, Integration Contracts, Deployment Targets, Hard Constraints, Anti-Hallucination Notes, Why This Architecture

**Updated files**:
- `GREENFIELD_BOOTSTRAP.md` — Step 2 split into 2A (Fill VISION.md) + 2B (Assign Roles + Register); VISION.md added to "What You'll Produce" and file list
- `BROWNFIELD_BOOTSTRAP.md` — same split; VISION.md added; codebase audit now happens *after* VISION.md is filled
- `README.md` — VISION.md added to Document Map

**Rule added**: Agents must be able to answer "Where does this code run?" from VISION.md before writing any code. If they cannot, the answer is not in the codebase — ask the human.

---

### New: AGENT_REGISTRY.md — Active agent workforce registry

**Summary**: Added `AGENT_REGISTRY.md` as a required bootstrap artifact. Provides a single source of truth for which AI agents are active, which roles they hold, what they're working on, and what state they're in. Enables multi-agent coordination with conflict resolution rules and a handoff protocol.

**New files**:
- `templates/AGENT_REGISTRY.md` — template with sections: Active Agents table, Agent Profiles, Role Coverage Map, Conflict Resolution Rules, Handoff Protocol, Multi-Agent Coordination Patterns, Retired Agents

**Updated files**:
- `GREENFIELD_BOOTSTRAP.md` — Agent registration added to Step 2B
- `BROWNFIELD_BOOTSTRAP.md` — Agent registration added to Step 2B
- `README.md` — AGENT_REGISTRY.md added to Document Map

**Rules added**:
- An agent must register itself before doing any work
- An agent must update its status before handing off or stopping
- File ownership: agent whose current task involves a file has exclusive write access until DONE
- Only the Governance role agent may update `PROJECT_STATE.md`, `AUTONOMY.md`, `AUTONOMY_METRICS.md` when multiple agents are active

**Source**: Agent OS 2.0 core framework upgrade directive (2026-06-08).

---

## v2.0.0 — 2026-06-07

### Breaking: Role model refactored from letter-based to role-based

**Summary**: Removed the Agent A / Agent B / Agent C naming convention. Replaced with named roles: Governance, Feature Development, Product, Architecture, Research, QA, Data, Deployment, Documentation. Any number of agents can be assigned any combination of roles.

**Changed files**:
- `AGENT_ROLES.md` — complete rewrite as a role catalog
- `README.md` — updated to describe role-based system; added version field and evolution system reference
- `GREENFIELD_BOOTSTRAP.md` — all agent letter references replaced with role names; role assignment step added
- `BROWNFIELD_BOOTSTRAP.md` — all agent letter references replaced with role names; role assignment step added
- `templates/AUTONOMY.md` — Governance role replaces "Agent C"; Stop Report template adds "Stopped by: [role]" and OS Evolution checkbox
- `templates/PROJECT_STATE.md` — Active Agents table added; "Updated by: Agent C" replaced with "Updated by: [Governance role]"
- `templates/DECISIONS.md` — "Agent B" reference replaced with role-based language
- `templates/BACKLOG.md` — "Agent A / B" references replaced; Role: tag added to item template
- `templates/AUTONOMY_METRICS.md` — "Agent C" replaced with "Governance role"; Role column added to Interruption Log; OS Evolution Queue section added
- `workflows/stop-report.md` — "Agent B/C" replaced with role language; "Stopped by: [role]" added to template
- `workflows/governance-improvement.md` — "Agent C" replaced with "Governance role"; escalation path to evolution/ added
- `workflows/context-compaction.md` — "Agent C" replaced with "Governance role"

### New: Evolution system

**Summary**: Added the evolution system enabling projects to feed improvements back to Agent OS.

**New files**:
- `evolution/PROPOSALS.md` — proposal submission format and tracking
- `evolution/CHANGELOG.md` — this file
- `workflows/periodic-review.md` — when and how to run periodic governance reviews and generate proposals

**Source**: Extracted from LocalPlus Mobile project governance system (session 1–3 experience).

---

## v1.0.0 — 2026-06-07

### Initial release

**Summary**: Agent OS extracted from the LocalPlus Mobile project. First stable version with Agent A/B/C role model.

**Files**:
- `README.md`
- `AGENT_ROLES.md` (v1 — letter-based)
- `GREENFIELD_BOOTSTRAP.md`
- `BROWNFIELD_BOOTSTRAP.md`
- `templates/` — PROJECT_STATE, DECISIONS, AUTONOMY, BACKLOG, HANDOFF, AUTONOMY_METRICS, CLAUDE
- `workflows/` — stop-report, governance-improvement, context-compaction

**Source project**: LocalPlus Mobile (Expo/React Native, Thailand lifestyle app). Governance system developed over 3 sessions; 7 interruptions logged; 105 minutes lost in session 1 (bootstrap); 0 interruptions in session 2 after governance rules applied.
