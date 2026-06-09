# ClubHub TV — Three-Agent Sync Prompt Generator
# Paste this entire prompt into any Claude agent session to generate a fresh sync prompt.
# The generated prompt can then be pasted into all three agents for drift-checking.
# This file never goes stale — it reads from live project state.

---

## YOUR TASK

You are generating a three-agent sync prompt for the ClubHub TV project. This is a meta-task: your output is a prompt that will be pasted into three different Claude agent sessions. Read the current project state, then produce the sync prompt following the template below.

**Do not do any development work. Your only output is the sync prompt.**

---

## STEP 1 — READ CURRENT PROJECT STATE

Read these files in order. You need all of them before writing anything.

**Memory index (read this first):**
- `/Users/admin/.claude/projects/-Users-admin-Dropbox-Development-clubhub-player/memory/MEMORY.md`

**All memory files linked from MEMORY.md** — read each one. They contain the current state of every major phase.

**Docs/shared directory listing** — run a glob for `docs/shared/*.md` to get the current document count and list.

**Recent git history:**
- Run: `git log --oneline -20` — note the most recent commits per domain (backend, frontend, contracts, governance, UX)

**Key source directories to spot-check** (just list, don't deep-read):
- `src/` — Agent 1's runtime/PRE work
- `backend/src/` — Agent 2's backend/governance work
- `docs/shared/` — Agent 3's UX architecture corpus
- `studio/` — Agent 2's Operator Control Plane (if exists)

---

## STEP 2 — IDENTIFY CURRENT STATE PER AGENT

From what you've read, determine:

**Agent 1 (Runtime / PRE / Execution):**
- What is the most recent completed work?
- What is explicitly marked "NEXT SESSION START HERE" or equivalent in memory?
- Is PRE.resolve() implemented? (check project_pre_implementation.md and project_bootstrap_phase.md)
- Any unresolved blockers?

**Agent 2 (CMS / Backend / Governance):**
- What is the most recent completed phase?
- What governance or backend work is in-progress or pending?
- Any contract enforcement gaps visible from memory?

**Agent 3 (UX Architecture):**
- How many docs exist in docs/shared/? List them.
- Are there any cross-reference gaps or missing artifacts called out in memory?
- Is DOMAIN-LANGUAGE-GLOSSARY.md present in docs/shared/? (This is the most-referenced missing artifact.)
- What is the capstone document? (should be AGENT-3-CAPSTONE-AND-DESIGN-LEGACY-v1.md)

**Missing artifacts (check for these specifically):**
- `docs/shared/DOMAIN-LANGUAGE-GLOSSARY.md` — canonical term definitions, referenced throughout corpus
- Any other documents referenced in memory as "missing" or "not yet created"

---

## STEP 3 — PRODUCE THE SYNC PROMPT

Write the following prompt verbatim, filling in all `[BRACKETED]` sections from what you read in Step 1–2. Do not skip sections. Do not summarize the template — write the full prompt.

The prompt you produce begins here:

---

# ClubHub TV — Three-Agent Sync and Drift Check
# Generated: [TODAY'S DATE]
# Paste this prompt into each agent session (Agent 1, Agent 2, Agent 3).
# Purpose: Re-orient to shared project state. Check for drift. Do not abandon in-progress work.

---

## WHO YOU ARE AND WHAT THIS IS

ClubHub TV has three active Claude agent sessions working in parallel on different domains:

- **Agent 1** — Runtime, PRE (Priority Resolution Engine), replay harness, chaos/soak validation, constitutional invariants
- **Agent 2** — Backend API, CMS, operator control plane, governance kernel, contract enforcement, database/auth
- **Agent 3** — UX architecture, operator experience design, docs/shared/ corpus (35 governance documents)

This prompt is a drift-check and re-orientation, not a task assignment. Read it, verify your current working assumptions match the shared state described here, flag any contradictions, then continue your current work. Do not abandon in-progress tasks.

---

## PLATFORM STATE AS OF [TODAY'S DATE]

### What exists and is working

**Runtime layer (Agent 1 domain):**
[2-4 bullet points summarizing Agent 1's completed work from memory — include replay harness, chaos tests, constitutional invariants, HA convergence, anything marked complete]

**Backend and governance layer (Agent 2 domain):**
[2-4 bullet points summarizing Agent 2's completed work from memory — include governance kernel, operator control plane, contract enforcement, any recent phase completions]

**UX architecture layer (Agent 3 domain):**
- docs/shared/ contains [N] documents across 9 phases — complete UX governance corpus
- Capstone: AGENT-3-CAPSTONE-AND-DESIGN-LEGACY-v1.md — final document, summarizes all phases
- Central thesis: operators trust systems they can predict
- Five irreducible principles: predictability, reconstructible past, visible causality, operator authority over intent, operational honesty

### What is pending or in-progress

**Agent 1 pending:**
[What memory says is the immediate next task for Agent 1 — exact description from memory]

**Agent 2 pending:**
[What memory says is the immediate next task for Agent 2 — exact description from memory]

**Agent 3 pending:**
[What memory says is pending for Agent 3, or "corpus complete — no pending docs" if all 9 phases are done]

### Known missing artifacts

[List any artifacts referenced in memory as missing or not yet created. Always check for DOMAIN-LANGUAGE-GLOSSARY.md specifically. If it doesn't exist in docs/shared/, list it here as: "DOMAIN-LANGUAGE-GLOSSARY.md — canonical term definitions. Referenced throughout the 35-doc corpus. Owned by Agent 2 (semantic governance is backend/governance domain). Not yet created."]

[If no missing artifacts found, write: "No known missing artifacts identified at time of generation."]

---

## RECENT WORK (last 20 commits)

[Paste the git log --oneline -20 output here, grouped loosely by domain if obvious]

---

## DOCS/SHARED DIRECTORY — COMPLETE LISTING

[List all files found in docs/shared/*.md, organized by phase. Use this format:]

**Governance foundations:**
- [list Phase 1 docs]

**Operational UX system design:**
- [list Phase 2 docs]

[Continue for all phases through Phase 9]

**Total: [N] documents**

---

## AUTHORITY BOUNDARIES (unchanged)

These do not change. All three agents must respect them.

- **Agent 1** owns: PRE resolution logic, replay determinism, constitutional invariants, chaos/soak validation, runtime execution
- **Agent 2** owns: backend API routes, database schema, CMS operations, operator control plane UI, governance kernel, contract enforcement, authentication, semantic governance (Domain Language Glossary)
- **Agent 3** owns: UX architecture docs (docs/shared/), operator experience design, explainability surfaces, UX governance — ADVISORY ONLY, never modifies PRE semantics or backend runtime

**Forbidden for all agents:**
- Modifying PRE resolution semantics without explicit cross-agent alignment
- Creating canonical term definitions outside the Domain Language Glossary (when it exists)
- Implementing backend runtime changes from UX documents without Agent 2 confirmation
- Silently overriding another agent's design decisions

---

## CONSTITUTIONAL UX CONSTRAINTS (Agent 3 reference — all agents should know these)

1. The PRE is the source of truth. UX explains PRE output — never overrides or reinterprets it.
2. Replay must be deterministic. PRE(screen_id, t, SystemState) → same output always.
3. Overrides are operational debt. UX surfaces must communicate override age, scope, and accumulation.
4. Explainability is non-negotiable. Every screen state must be explainable to an operator in under 30 seconds.
5. Preview before commit. No destructive operator action without a PRE-evaluated preview of consequences.
6. Advisory-only entropy reporting. The platform surfaces entropy signals; operators decide whether to act.

---

## DRIFT-CHECK QUESTIONS — ANSWER THESE FOR YOUR DOMAIN

Before continuing your current work, confirm:

**If you are Agent 1:**
- Does your current implementation of PRE.resolve() (or your plan for it) match the 7-level resolution hierarchy in the bootstrap memory?
- Are all 10 constitutional invariants still enforced in the replay harness?
- Does your understanding of the HA convergence model match what project_ha_convergence.md describes?

**If you are Agent 2:**
- Are your API routes consistent with the contract bindings described in project_enforcement_phase.md?
- Does your operator control plane implementation align with the UX governance constraints in docs/shared/?
- Is the Domain Language Glossary on your backlog? It's the most-referenced missing artifact in the corpus.

**If you are Agent 3:**
- Do all 35 documents in docs/shared/ exist? Run a glob to verify count.
- Are there cross-reference notes between overlapping document pairs (Entropy Observability ↔ Attention Economics; Intervention/Override ↔ Failure Containment; Operational Fatigue ↔ Operational Rhythm)?
- Does anything in recent Agent 1 or Agent 2 work require a UX governance update?

---

## WHAT TO DO AFTER READING THIS

1. **Verify** your current working state matches the shared state described above.
2. **Flag** any contradiction between your current assumptions and what this prompt describes. State it explicitly: "I see a drift: I believed X but this prompt says Y."
3. **Update memory** if you have completed significant work since the last memory update. Write to your agent's memory file following the existing format.
4. **Continue your current work.** This prompt does not change your task unless you flagged a contradiction that needs resolution first.

If you flagged a contradiction, resolve it before continuing — either by re-reading the relevant governance document, or by noting it for cross-agent alignment.

---

*This sync prompt was generated on [TODAY'S DATE] from live project state.*
*To generate a fresh version, paste docs/SYNC-PROMPT-GENERATOR.md into any agent session.*

---

## END OF GENERATED PROMPT

Your output should be the filled-in prompt above and nothing else. Do not add commentary before or after it. The user will copy-paste it directly into agent sessions.
