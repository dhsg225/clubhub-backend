# PLUGIN_DEVELOPMENT_GUIDE.md
# Governance Kernel — Plugin Development Guide

---

## Plugin contract

A plugin must declare:

```javascript
const MyPlugin = {
  name:               'my-plugin',
  version:            '1.0.0',
  determinismLevel:   'DETERMINISTIC_PER_DB',
  replayabilityLevel: 'PARTIALLY_REPLAYABLE',
  authorityLevel:     'DB_AUTHORITATIVE',
  haSafetyLevel:      'ACTIVE_ACTIVE_READS',
  bypassGovernance:   false,                    // HARD: must be false

  capabilities: Object.freeze({ ... }),
  nondeterministicPaths: Object.freeze([ ... ]),
  governanceGuarantees: Object.freeze({ ... }),
};
plugins.register(MyPlugin);
module.exports = MyPlugin;
```

`bypassGovernance: true` is a **hard rejection** — `plugins.register()` throws.

---

## Authority boundary rule

```
PERMITTED:  require('governance-kernel/api/...')
FORBIDDEN:  require('governance-kernel/core/...')
FORBIDDEN:  require('lib/governed-config')
FORBIDDEN:  require('lib/governed-clock')
FORBIDDEN:  new Pool(...)  — pool is injected, not created
```

---

## Dependency injection pattern

All kernel dependencies must be injected:

```javascript
class MyRuntime {
  init(deps = {}) {
    this._authorityCoordinator = deps.authorityCoordinator;
    this._freezeController     = deps.freezeController;
    this._incidentManager      = deps.incidentManager;
    this._auditLedger          = deps.auditLedger;
    this._configAuthority      = deps.configAuthority;
    this._operatorAuthority    = deps.operatorAuthority;
    this._eventBus             = deps.eventBus;
  }
}
```

---

## Replay safety requirements

Every plugin MUST declare which operations are replay-safe and which are mutations.

For each mutation method, add a guard:

```javascript
const replayHooks = require('./replay-hooks'); // your own module, no kernel imports

async function performMutation(opts) {
  replayHooks.assertNotReplay('myPlugin.performMutation');
  // ... proceed
}
```

Replay hooks module must have NO kernel imports. It is a pure state flag.

---

## Event emission

Plugins emit events through the injected event bus:

```javascript
this._eventBus.emit('governance.myplugin.action_performed', {
  operator_id: opts.operator_id,
  lineage_ts:  new Date().toISOString(),
  // ... payload
});
```

Event types must use the `governance.` namespace prefix.

---

## Audit attribution

Every operator mutation must append to AuditLedger:

```javascript
this._auditLedger.appendEntry({
  action_type:  'myplugin_operation',
  operator_id:  opts.operator_id ?? null,
  justification: opts.justification ?? '',
});
```

For LINEARIZED operations use `appendLinearized(pool, opts)`.

---

## Certification requirements

Each plugin should provide a certification suite. Minimum checks:

1. No `governance-kernel/core/` imports in plugin modules
2. No `pg.Pool` creation in plugin modules
3. All mutating operations call `assertNotReplay()` or equivalent
4. All POST routes gated by `requireAuth` middleware
5. All POST routes append to AuditLedger

Reference implementation: `plugins/ota-runtime/certification/`

---

## UI extension contract

Plugins that contribute operator UI panels must declare extensions through `UIPluginRegistry`:

```javascript
const UIPluginRegistry = ...; // injected from operator-ui

UIPluginRegistry.register({
  id:           'my-plugin-view',
  type:         'VIEW',              // VIEW | REPLAY_RENDERER | TOPOLOGY_OVERLAY
  replaySafe:   true,                // required for REPLAY_RENDERER
  deterministic: false,              // declare honestly
  render:       (state) => { ... },  // pure function
  bypassGovernance: false,           // HARD: must be false
});
```

Extension types `FREEZE_OVERRIDE`, `CERTIFICATION_OVERRIDE`, `AUTH_PROVIDER`, `COMMAND_INJECTOR` are permanently forbidden.

---

## Determinism levels

| Level | Meaning |
|-------|---------|
| FULLY_DETERMINISTIC | Same inputs → same outputs, no external dependencies |
| DETERMINISTIC_PER_DB | Deterministic within a DB sequence, not content-addressed |
| NONDETERMINISTIC | Contains wall-clock or external inputs |

Declare honestly. The certification suite validates declared nondeterministic paths are documented.
