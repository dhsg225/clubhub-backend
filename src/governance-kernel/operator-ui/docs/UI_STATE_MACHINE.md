# UI_STATE_MACHINE.md
# Operator UI — UI State Machine

## Overview

The operator UI has a formal state machine that governs which controls are active, which
panels are visible, and how the UI responds to incoming governance events.

## Top-level UI states

```
UNAUTHENTICATED
      │
      │  login success
      ▼
ACTIVE ◄──────────────────────────────────────────────────────┐
  │                                                           │
  │ split_brain event          │ replay enter                 │
  ▼                            ▼                              │
SPLIT_BRAIN_ALERT          REPLAY_MODE                        │
  │                            │                              │
  │ split_brain cleared         │ replay exit                 │
  └────────────────────────────┘                              │
                                                              │
  frozen event                                                │
      ▼                                                       │
 FROZEN ──── unfreeze ────────────────────────────────────────┘
```

## State definitions

### UNAUTHENTICATED

- No operator token present or token expired
- Login form displayed
- No governance events processed

### ACTIVE

Normal operational state. All controls enabled per role.

- Event stream connected
- All role-appropriate mutation controls visible and enabled
- Topology panel shows live node states
- Incident panel shows active incidents
- Config panel shows current config

### FROZEN

Freeze event received (`governance.freeze.frozen`).

- **All mutation controls disabled** except "Unfreeze" (ADMIN only)
- Yellow frozen banner displayed: "DEPLOYMENT FROZEN — [reason] — epoch [n]"
- Incident viewing allowed (VIEWER)
- Config viewing allowed (VIEWER)
- Event stream continues

Transitions:
- `governance.freeze.unfrozen` → ACTIVE

### REPLAY_MODE

Replay entered (`governance.runtime.lifecycle_changed` with `to_state: 'REPLAY'`).

- **All mutation controls disabled** (no exceptions)
- REPLAY MODE banner displayed (see `REPLAY_VISUALIZATION_MODEL.md`)
- Event timeline panel active
- ForensicView mode for incident/config panels

Transitions:
- `governance.runtime.lifecycle_changed` with `to_state: 'ACTIVE'` → ACTIVE

Note: FROZEN and REPLAY_MODE can coexist. When both active, both banners shown.

### SPLIT_BRAIN_ALERT

Split-brain detected (`governance.authority.split_brain`).

- **All mutation controls disabled**
- CRITICAL alert banner: "SPLIT-BRAIN DETECTED — Mutations blocked"
- Topology panel shows divergent epochs per node
- Manual resolution instructions shown

Transitions:
- `governance.authority.epoch_changed` where split_brain resolved → ACTIVE

## State transition table

| From state          | Event                                       | To state            |
|---------------------|---------------------------------------------|---------------------|
| UNAUTHENTICATED     | login success                               | ACTIVE              |
| ACTIVE              | `governance.freeze.frozen`                  | FROZEN              |
| ACTIVE              | `governance.runtime.lifecycle_changed` REPLAY | REPLAY_MODE       |
| ACTIVE              | `governance.authority.split_brain`          | SPLIT_BRAIN_ALERT   |
| FROZEN              | `governance.freeze.unfrozen`                | ACTIVE              |
| REPLAY_MODE         | `governance.runtime.lifecycle_changed` ACTIVE | ACTIVE            |
| SPLIT_BRAIN_ALERT   | split_brain cleared event                   | ACTIVE              |
| any                 | token 401                                   | UNAUTHENTICATED     |
| any                 | SSE disconnect                              | RECONNECTING        |

## RECONNECTING sub-state

On SSE disconnect, UI enters RECONNECTING overlay (does not leave current state):

```
Current state (ACTIVE/FROZEN/etc.)
  + RECONNECTING overlay
      ├── Show "Reconnecting to event stream..."
      ├── Disable all mutation controls during gap
      └── On reconnect: remove overlay, resume event processing
```

## Control enable/disable matrix

| Control type    | ACTIVE | FROZEN | REPLAY | SPLIT_BRAIN | RECONN |
|-----------------|--------|--------|--------|-------------|--------|
| Freeze          | ✓*     | ✗      | ✗      | ✗           | ✗      |
| Unfreeze        | ✗      | ✓**    | ✗      | ✗           | ✗      |
| Promote wave    | ✓*     | ✗      | ✗      | ✗           | ✗      |
| Create incident | ✓*     | ✗      | ✗      | ✗           | ✗      |
| Update config   | ✓**    | ✗      | ✗      | ✗           | ✗      |
| View incidents  | ✓      | ✓      | ✓      | ✓           | ✓      |
| View config     | ✓      | ✓      | ✓      | ✓           | ✓      |
| View audit log  | ✓      | ✓      | ✓      | ✓           | ✓      |

Legend: ✓ enabled, ✗ disabled, * OPERATOR role, ** ADMIN role

## Banner priority

When multiple conditions apply, banners stack top-to-bottom:

1. SPLIT_BRAIN (CRITICAL — red)
2. REPLAY MODE (WARNING — orange)
3. FROZEN (CAUTION — yellow)
4. RECONNECTING (INFO — blue)

## Persistence across page reload

UI state is derived from the event stream + initial snapshot, not local storage.
On page load:

1. Call `GET /runtime/snapshot` to get current state
2. Apply initial state to UI state machine
3. Connect SSE stream
4. Process events from stream to update state

This ensures UI state is always authoritative — never stale from a previous session.

## See also

- `EVENT_STREAM_MODEL.md` — events that drive transitions
- `AUTHORITY_SURFACE_GUIDE.md` — per-control authority requirements
- `REPLAY_VISUALIZATION_MODEL.md` — REPLAY_MODE display contract
