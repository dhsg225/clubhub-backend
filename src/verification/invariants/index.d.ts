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
import type { PRE_Output, PRE_Input } from '../../pre/types';
import { type InvariantDefinition, type InvariantResult } from './types';
/**
 * Register an invariant. Called at module load time by each invariant file.
 * Throws if an invariant with the same ID is already registered.
 */
export declare function registerInvariant(def: InvariantDefinition): void;
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
export declare function runAllInvariants(output: PRE_Output, input: PRE_Input): InvariantResult[];
/**
 * Return all registered invariant IDs, sorted numerically.
 * Used by CI to verify all 10 invariants are registered.
 */
export declare function registeredInvariantIds(): string[];
/**
 * Assert that all 10 constitutional invariants are registered.
 * Called during CI invariant-verify stage.
 * Throws if any invariant is missing.
 */
export declare function assertAllInvariantsRegistered(): void;
import './inv1-purity';
import './inv2-totality';
import './inv3-determinism';
import './inv4-monotone-version';
import './inv5-level-termination';
import './inv6-no-amplification';
import './inv7-emergency-absolute';
import './inv8-sponsor-non-penetration';
import './inv9-timezone-isolation';
import './inv10-output-completeness';
//# sourceMappingURL=index.d.ts.map