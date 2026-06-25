# UI Plugin Extension Contracts

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## Plugin UI extension declaration

```javascript
{
  name: 'my-plugin',           // Must match kernel PluginRegistry name
  version: '1.0.0',
  extensions: [
    {
      type: 'VIEW',            // VIEW | REPLAY_RENDERER | TOPOLOGY_OVERLAY
      id: 'my-plugin.status',
      label: 'My Plugin Status',
      bypassGovernance: false, // MUST be false — hard rejection if true

      // Render function contract:
      // (storeSlice, opts) => { title, sections: [{ label, value }] }
      // Must be PURE — no side effects, no kernel imports
      render: (storeSlice, opts) => ({ ... }),

      replaySafe: true,        // Required for REPLAY_RENDERER; advisory for others
      deterministic: true,     // true if output is deterministic given same input
    }
  ]
}
```

---

## What plugins CAN do in UI extensions

- Read from GovernedStateStore slices passed to render()
- Render plugin-specific status data
- Display plugin determinism level, authority level, HA safety
- Contribute topology overlays showing plugin node state
- Contribute replay renderers for plugin-specific event types

## What plugins CANNOT do

- Import governance-kernel/core/ or api/ modules
- Hold references to kernel instances
- Call mutating API routes
- Modify `authority_epoch`, `lineage_ts`, or consistency metadata
- Override freeze visualization
- Override certification status indicators
- Declare `bypassGovernance: true`
- Access the DB directly
- Maintain state outside the render function call

---

## Replay renderer contract

```javascript
{
  type: 'REPLAY_RENDERER',
  id: 'my-plugin.replay',
  event_types: ['governance.plugin.my-plugin.*'],  // events this renderer handles
  replaySafe: true,   // required
  deterministic: true, // required for replay renderers

  // Called for each matching event during replay
  // Must return same output for same event (deterministic)
  render: (event, replayCursor) => ({
    label: string,
    fields: [{ key, value }],
  }),
}
```

---

## Lifecycle

1. `UIPluginRegistry.register(plugin)` — called at app startup
2. `UIPluginRegistry.getExtensions(type)` — called at render time
3. `UIPluginRegistry.getReplaySafeExtensions(type)` — called during replay mode
4. Extensions are garbage-collected when plugin is unregistered (not in v1)
