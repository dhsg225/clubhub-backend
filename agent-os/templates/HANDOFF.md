# Handoff — Current State Snapshot

Last updated: YYYY-MM-DD — [session description]

> **Rule**: Before treating any item here as "broken," read the actual source file. This document is a snapshot; code changes underneath it.

---

## What Is Working (verified in code)

[For each working feature area, describe what was verified and where the key files are. Be specific enough that an agent reading this can understand the feature without reading the code.]

- **[Feature]** (`path/to/file`): [What it does and what's confirmed working.]
- **[Feature]** (`path/to/file`): [What it does and what's confirmed working.]

---

## Known Gaps (current as of YYYY-MM-DD)

[List features that are incomplete, broken, or not yet built. Include the BACKLOG item ID.]

### [Feature name] — [BL-NNN] [Status: e.g. IN PROGRESS / BLOCKED / FUTURE]

[Description of what's missing and why.]

---

## Schema / Data Reference

[Document any key data structures, API shapes, or database schemas that agents frequently need. This prevents agents from reading source files just to check a field name.]

### [Entity name] (source: [file or table])
```
field1, field2, field3, ...
```
Note: [Any important notes — which fields are nullable, which are unused, etc.]

---

## Environment Checklist (fresh start)

- [ ] [Required env var or config step]
- [ ] [Another required step]
- [ ] [Command to verify the app runs]

---

## Read Order for New Agents

1. `PROJECT_STATE.md` — current status
2. `DECISIONS.md` — what's settled
3. `BACKLOG.md` — what to work on
4. Relevant type/schema files before implementing data-dependent features

<!--
INSTRUCTIONS FOR AGENT B:

Update this file after completing each feature area.
- Add confirmed-working items to "What Is Working"
- Remove or promote items from "Known Gaps" as they are completed
- Keep schema references accurate — agents use this to avoid re-reading type files

Do NOT describe what was planned — only what is confirmed working in code.
-->
