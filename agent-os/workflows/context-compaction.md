# Context Compaction Workflow

Context is a finite resource. Every line an agent reads is a line it cannot use for work. Context compaction keeps active documents lean so agents start sessions with maximum capacity for actual work.

This workflow is owned by the **Governance role**.

---

## The Problem

Over time, governance documents accumulate:
- Completed BACKLOG items with full spec detail no longer needed
- `DECISIONS.md` entries for shipped features that are now stable history
- `HANDOFF.md` feature descriptions for fully-working features
- `AUTONOMY.md` interruption logs that grow with each session

When an agent reads a 300-line `BACKLOG.md` to find 3 active TODO items, 297 lines of context were wasted. Compaction fixes this.

---

## Compaction Triggers

The Governance role should compact when:

1. **`BACKLOG.md` exceeds 150 lines** with most of that being completed items
2. **`DECISIONS.md` exceeds 200 lines** with most entries being shipped/stable
3. **`HANDOFF.md §What Is Working` grows beyond 60–80 lines**
4. **`PROJECT_STATE.md` exceeds 100 lines** (this is a hard cap)
5. **`AUTONOMY.md` Interruption Log exceeds 20 rows** (log stays; old rows move)

---

## Compaction Rules by Document

### BACKLOG.md

**Keep in active file**:
- All TODO and IN PROGRESS items (full spec)
- All BLOCKED items (full spec — agents need to know *why*)
- All WAITING items (full spec)
- The completed items table (ID, date, one-line summary only)

**Move to `archive/BACKLOG_ARCHIVE.md`**:
- Full specs of DONE items
- Full specs of NO-OP items

**How**: When an item is marked DONE, immediately collapse it in the Completed table to a single line. Do not keep full acceptance criteria in the active file.

---

### DECISIONS.md

**Keep in active file**:
- All Active decisions (full text)
- Superseded decisions (header + "Superseded by D-NNN" only)

**Move to `archive/DECISIONS_DETAIL.md`**:
- Full rationale for decisions that are stable and rarely referenced

**How**: When a decision is more than 2 months old and hasn't been referenced in a Stop Report, compress it to: Decision statement + key implication only. Move full rationale to archive.

**Never compress**:
- Decisions actively constraining agent behaviour ("never bypass auth")
- Decisions with multi-step implications
- Decisions with `Needs Human` status

---

### HANDOFF.md

**Keep in active file**:
- `§What Is Working`: brief bullet per feature (one line each: file path + what's confirmed)
- `§Known Gaps`: all incomplete/broken/future items (full detail)
- `§Schema / Data Reference`: keep always
- `§Environment Checklist`: keep always

**Move to `archive/HANDOFF_HISTORY.md`**:
- Detailed working descriptions of features stable for 2+ sessions

**How**: When a feature is working and untouched for 2 sessions, compress its `§What Is Working` entry to one line.

---

### PROJECT_STATE.md

Hard cap: **100 lines**. This is the most-read document. If it exceeds 100 lines, compact immediately.

**Must always be present**:
- Project description (one paragraph)
- Active agents table
- Feature status table (one line per feature)
- Active human actions
- Current blockers
- Next 3–5 recommended actions
- Architecture snapshot (≤20 lines)
- Governance health table
- Agent Resume Protocol

**Remove when over cap**:
- Detailed architecture prose (move to `CLAUDE.md`)
- Historical notes about what changed when
- Resolved blocker detail
- Completed workstream descriptions

---

### AUTONOMY.md

**Keep in active file**:
- All zone rules (always current)
- Recurring Patterns table (always current)
- Full stop report template
- Interruption Log (last 10 rows + all unresolved stops)

**Move to `archive/AUTONOMY_HISTORY.md`**:
- Interruption log rows beyond 20 entries

---

## The archive/ Folder

```
archive/
├── BACKLOG_ARCHIVE.md      # Full specs of completed BACKLOG items
├── DECISIONS_DETAIL.md     # Full rationale for compressed DECISIONS.md entries
├── HANDOFF_HISTORY.md      # Old feature detail from HANDOFF.md
└── AUTONOMY_HISTORY.md     # Old interruption log rows
```

**Archive rules**:
- Append-only — never edit existing archive content
- Never read on cold start — only when specifically looking up history
- Each section has a dated header when archived:
  ```
  ## Archived YYYY-MM-DD
  [content]
  ```

---

## Compaction Procedure

1. Identify which document and which sections to compact
2. Open (or create) the archive file
3. Copy content to archive with dated section header
4. Replace in active file with compressed version
5. Verify active file still contains everything needed to start working
6. Update `PROJECT_STATE.md` if compaction affected feature status or blockers

---

## What Not to Compact

- Active TODO/BLOCKED/IN PROGRESS backlog items
- Decisions that constrain current agent behaviour
- The Stop Report template in `AUTONOMY.md`
- Zone rules in `AUTONOMY.md`
- Environment checklists in `HANDOFF.md`
- Schema/type reference in `HANDOFF.md`
- The Agent Resume Protocol in `PROJECT_STATE.md`

When in doubt: if an agent would need to look this up during a normal session, keep it in the active file.

---

## Context Budget Estimation

| Document | Typical lines (compacted) | Context % (approx) |
|---|---|---|
| `PROJECT_STATE.md` (capped at 100) | ~80 | ~4% |
| `BACKLOG.md` (active items only) | ~50 | ~3% |
| `DECISIONS.md` (active) | ~100 | ~5% |
| `CLAUDE.md` (lean) | ~100 | ~5% |
| `HANDOFF.md` (compacted) | ~80 | ~4% |
| `AUTONOMY.md` | ~150 | ~7% |

**Two-file cold start** (`PROJECT_STATE` + `BACKLOG`): ~7% context used before work begins.
**Five-file overload** (all files pre-loaded): ~28% context used before work begins.

The goal is the two-file cold start for every session. Compaction is what makes it possible.
