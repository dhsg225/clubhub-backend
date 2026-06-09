"use strict";
/**
 * Invariant Registry — registers and runs INV-1 through INV-10.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4.1
 *
 * Usage:
 *   import { registerInvariant, runAllInvariants } from './index';
 *
 * All invariant files import this module and call registerInvariant() at
 * module load time. The harness imports all invariant files to trigger
 * registration, then calls runAllInvariants().
 *
 * Execution order: sorted by invariant ID numerically (INV-1 first).
 * The sort is deterministic — no implicit ordering dependency.
 *
 * Failure behavior:
 * - CONSTITUTIONAL_BREACH or CATASTROPHIC: throws InvariantViolationError immediately
 * - ERROR or below: collected into results array; all invariants run
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInvariant = registerInvariant;
exports.runAllInvariants = runAllInvariants;
exports.registeredInvariantIds = registeredInvariantIds;
exports.assertAllInvariantsRegistered = assertAllInvariantsRegistered;
const types_1 = require("./types");
// Use var (not let/const) to avoid CJS circular-dependency temporal dead zone.
// In CJS (tsx), side-effect imports at the bottom of this file are require()'d
// while this module is still initializing. With let/const the variable is in TDZ
// and cannot be accessed. With var it is hoisted and initialized to undefined,
// so the lazy initializer below works correctly.
// eslint-disable-next-line no-var
var _registryStoreStore;
function getRegistry() {
    if (_registryStoreStore === undefined) {
        _registryStoreStore = new Map();
    }
    return _registryStoreStore;
}
/**
 * Register an invariant. Called at module load time by each invariant file.
 * Throws if an invariant with the same ID is already registered.
 */
function registerInvariant(def) {
    const registry = getRegistry();
    if (registry.has(def.id)) {
        throw new Error(`Duplicate invariant registration: "${def.id}". ` +
            `Each invariant ID must be registered exactly once.`);
    }
    registry.set(def.id, def);
}
/**
 * Run all registered invariants against the given PRE output and input.
 *
 * Execution order: numeric sort of invariant IDs (INV-1 before INV-2, etc.)
 *
 * Invariants with severity CONSTITUTIONAL_BREACH or CATASTROPHIC:
 *   - If the invariant fails, throws InvariantViolationError immediately.
 *   - No subsequent invariants run after a throw.
 *
 * Invariants with severity ERROR or below:
 *   - Failures are collected; all invariants run regardless of failures.
 *   - Results returned to caller.
 *
 * @throws InvariantViolationError if any CONSTITUTIONAL_BREACH or CATASTROPHIC fails
 */
function runAllInvariants(output, input) {
    // Sort by numeric part of ID for deterministic execution order
    const sorted = [...getRegistry().values()].sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10);
        const numB = parseInt(b.id.replace(/\D/g, ''), 10);
        return numA - numB;
    });
    const results = [];
    for (const inv of sorted) {
        let result;
        try {
            result = inv.assert(output, input);
        }
        catch (err) {
            // Assertion function itself threw — treat as invariant failure
            result = {
                invariantId: inv.id,
                passed: false,
                message: `Assertion threw: ${String(err)}`,
                severity: inv.severity,
            };
        }
        results.push(result);
        // Constitutional/catastrophic failures escalate immediately
        if (!result.passed &&
            (result.severity === 'CONSTITUTIONAL_BREACH' ||
                result.severity === 'CATASTROPHIC')) {
            throw new types_1.InvariantViolationError(result);
        }
    }
    return results;
}
/**
 * Return all registered invariant IDs, sorted numerically.
 * Used by CI to verify all 10 invariants are registered.
 */
function registeredInvariantIds() {
    return [...getRegistry().keys()].sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10);
        const numB = parseInt(b.replace(/\D/g, ''), 10);
        return numA - numB;
    });
}
/**
 * Assert that all 10 constitutional invariants are registered.
 * Called during CI invariant-verify stage.
 * Throws if any invariant is missing.
 */
function assertAllInvariantsRegistered() {
    const required = [
        'INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5',
        'INV-6', 'INV-7', 'INV-8', 'INV-9', 'INV-10',
    ];
    const registered = new Set(getRegistry().keys());
    const missing = required.filter(id => !registered.has(id));
    if (missing.length > 0) {
        throw new Error(`CONSTITUTIONAL_BREACH: Missing invariant registrations: ${missing.join(', ')}. ` +
            `All 10 PRE invariants must be registered before the harness runs.`);
    }
}
// ─── Load all invariant files (triggers registration) ─────────────────────────
// This import block is at the bottom of the file to ensure `registerInvariant`
// is defined before any invariant module executes.
require("./inv1-purity");
require("./inv2-totality");
require("./inv3-determinism");
require("./inv4-monotone-version");
require("./inv5-level-termination");
require("./inv6-no-amplification");
require("./inv7-emergency-absolute");
require("./inv8-sponsor-non-penetration");
require("./inv9-timezone-isolation");
require("./inv10-output-completeness");
//# sourceMappingURL=index.js.map