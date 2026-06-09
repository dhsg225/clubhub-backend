# Go Commands — ClubHub TV Agents

## The RESUME command (send this to any agent)

```
RESUME

Read in order:
1. agent-os/AGENT_REGISTRY.md — find your entry, read your Next action
2. agent-os/BACKLOG.md — active items only
3. agent-os/AUTONOMY.md — zone rules and stop report template (read once, not every session)
4. agent-os/HANDOFF.md — on demand only

Execute your Next action. When you stop for any reason — including clean completion —
use the stop report template from AUTONOMY.md §MANDATORY STOP PROCEDURE verbatim.
Do not summarise it. Do not skip fields.
```

## How it works

The RESUME command is the same for all three agents. Each agent identifies itself
from AGENT_REGISTRY.md and reads its own `Next action` line to know where to start.

**This only works if AGENT_REGISTRY.md is kept current.** After every session,
the Governance role must update each active agent's entry with:
- Updated `Status`
- Updated `Next action` line
- Any new in-flight files

## Who is who

| Your label | Registry name | Role |
|---|---|---|
| Agent A | QA-1 | QA / Infrastructure |
| Agent B | ARCH-1 | Architecture |
| Agent C | DOCS-1 | Documentation |
