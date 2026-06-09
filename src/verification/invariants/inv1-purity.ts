/**
 * INV-1: Purity
 *
 * PRE.resolve() must be a pure function: no side effects, no writes,
 * no network access, no randomness.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.1
 * Forbidden patterns: FP-02 (side effects in PRE), FP-03 (mutation on poll path)
 *
 * Runtime enforcement strategy:
 * INV-1 cannot be fully verified by inspecting the output alone — purity is
 * a behavioral property of the execution context, not the result.
 *
 * This invariant uses two enforcement mechanisms:
 * 1. Static: The forbidden-pattern scanner (CI stage 05) detects write operations,
 *    network imports, Date.now(), Math.random() in src/pre/ at PR time.
 * 2. Dynamic: The in-memory-db wrapper (src/verification/replay/in-memory-db.ts)
 *    throws if PRE attempts any write during replay execution.
 *
 * This invariant assertion validates the static contract by checking that the
 * output does not contain fields that would only be present if PRE had performed
 * a write (e.g., a newly generated ID, a timestamp that wasn't in the input).
 */

import { registerInvariant } from './index';

registerInvariant({
  id: 'INV-1',
  description: 'PRE.resolve() is a pure function — no side effects, no writes, no network',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, input) {
    // The primary runtime enforcement is the write-intercepting in-memory-db.
    // If PRE has written anything, that db layer has already thrown.
    // This assertion validates the output-level purity contract:

    // 1. output.screen_id must match input.screen_id — PRE cannot invent a new screen_id
    if (output.screen_id !== input.screen_id) {
      return {
        invariantId: 'INV-1',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Purity violation: output.screen_id "${output.screen_id}" ` +
          `does not match input.screen_id "${input.screen_id}". ` +
          `PRE cannot change the identity of the screen being resolved.`,
      };
    }

    // 2. output.resolved_at must match input.at — PRE cannot use a different timestamp
    if (output.resolved_at !== input.at) {
      return {
        invariantId: 'INV-1',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Purity violation: output.resolved_at ${output.resolved_at} ` +
          `does not match input.at ${input.at}. ` +
          `PRE must use the provided timestamp, not Date.now() or any other source.`,
      };
    }

    // 3. output.output_schema_version must be the fixed constant
    if (output.output_schema_version !== '1.0.0') {
      return {
        invariantId: 'INV-1',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Purity violation: output.output_schema_version is "${output.output_schema_version}", ` +
          `expected "1.0.0". PRE must not modify the schema version field.`,
      };
    }

    return {
      invariantId: 'INV-1',
      passed: true,
      severity: 'CONSTITUTIONAL_BREACH',
      message: 'Purity contract holds: screen_id, resolved_at, and schema_version are consistent with input',
    };
  },
});
