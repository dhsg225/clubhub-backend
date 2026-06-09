# UI Plugin Sandbox Rules

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## Sandbox model

Plugin UI extensions run in the same process as the control plane but are
**isolated by contract** (not by OS sandbox in v1).

Contract enforcement is performed by `UIPluginRegistry` at registration time
and by `AuthorityBoundaryCertification` in CI.

---

## Hard rules (enforced — auto-reject on violation)

1. **bypassGovernance MUST be false**
   `UIPluginRegistry.register()` throws if any extension has `bypassGovernance: true`.

2. **No kernel imports in render functions**
   `AuthorityBoundaryCertification` statically analyzes plugin source for
   `governance-kernel/core/` and `governance-kernel/api/` imports.

3. **REPLAY_RENDERER must declare replaySafe: true**
   Replay renderers with `replaySafe: false` are not called during replay mode.

4. **Frozen surface types are blocked**
   Extensions cannot declare `FREEZE_OVERRIDE`, `CERTIFICATION_OVERRIDE`,
   `AUTH_PROVIDER`, or `COMMAND_INJECTOR` types.

---

## Advisory rules (not auto-enforced in v1)

5. **Render functions should be pure**
   Render functions should not maintain state or cause side effects.
   Non-pure renderers will produce inconsistent replay behavior.

6. **Non-deterministic renderers excluded from replay**
   If `deterministic: false`, the renderer is excluded from replay mode
   even if `replaySafe: true`. It may still be used in LIVE mode.

7. **Replay renderers should handle unknown event fields gracefully**
   Event schemas may have evolved between capture and replay.
   Renderers should default gracefully for unknown fields.

---

## v1 sandbox limitations

In v1, the sandbox is contract-only (no OS-level or VM isolation).

Plugin render functions run in the same event loop as the control plane.
A misbehaving plugin render function could block the event loop.

Planned for v2:
- Worker thread isolation for plugin render functions
- Resource limits per plugin
- Import whitelist enforcement via Module.createRequire

These are v2 advisory gaps — no RFC required until implementation begins.

---

## Certification integration

`AuthorityBoundaryCertification` (v1) checks:
- Each registered UIPlugin has `bypassGovernance: false` on all extensions
- No kernel module imports in plugin source files (static analysis)
- REPLAY_RENDERER extensions declare `replaySafe: true`

This check runs as part of the UI certification suite.
