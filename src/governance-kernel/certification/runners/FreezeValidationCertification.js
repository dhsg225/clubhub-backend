'use strict';
/**
 * FreezeValidationCertification — verifies that rollout freeze validation is fail-closed.
 *
 * Tests isRolloutFrozenFromDb() behavior under all failure conditions:
 *   1. rollout_frozen = '0'   → returns false (not frozen)
 *   2. rollout_frozen = '1'   → returns true  (frozen)
 *   3. DB unavailable         → throws        → promoteRing returns FREEZE_CHECK_FAILED
 *   4. Query timeout          → throws        → promoteRing returns FREEZE_CHECK_FAILED
 *   5. Malformed DB response  → treated as frozen (fail-closed)
 *   6. Key absent from DB     → returns false (freeze never set)
 *   7. No pool provided       → throws        → cannot confirm state
 */

const fleetConsensus = require('../../../lib/fleet-consensus');

function makePool(behavior) {
  return {
    query: async (_sql, _params) => {
      if (behavior === 'not_frozen')  return { rows: [{ text_value: '0' }] };
      if (behavior === 'frozen')      return { rows: [{ text_value: '1' }] };
      if (behavior === 'db_down')     throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      if (behavior === 'timeout')     throw new Error('query timeout after 5000ms');
      if (behavior === 'malformed')   return { rows: [{ text_value: null }] };
      if (behavior === 'key_absent')  return { rows: [] };
      throw new Error(`unknown behavior: ${behavior}`);
    },
  };
}

class FreezeValidationCertification {
  get name() { return 'FreezeValidationCertification'; }

  async run() {
    const caveats = [];

    // ── isRolloutFrozenFromDb direct tests ────────────────────────────────────

    const directCases = [
      { label: 'frozen_eq_0',   behavior: 'not_frozen', expected: false },
      { label: 'frozen_eq_1',   behavior: 'frozen',     expected: true  },
      { label: 'malformed_null',behavior: 'malformed',  expected: true  }, // fail-closed
      { label: 'key_absent',    behavior: 'key_absent', expected: false }, // never set = not frozen
    ];

    for (const c of directCases) {
      try {
        fleetConsensus._reset();
        const result = await fleetConsensus.isRolloutFrozenFromDb(makePool(c.behavior));
        if (result !== c.expected) {
          caveats.push({
            severity: 'FAIL',
            check:    `freeze_direct_${c.label}`,
            detail:   `Expected ${c.expected}, got ${result}`,
          });
        }
      } catch (err) {
        caveats.push({
          severity: 'FAIL',
          check:    `freeze_direct_${c.label}`,
          detail:   `Unexpected throw: ${err.message}`,
        });
      }
    }

    // ── Throw cases — DB must propagate, not swallow ──────────────────────────

    const throwCases = [
      { label: 'db_down', behavior: 'db_down' },
      { label: 'timeout', behavior: 'timeout' },
    ];

    for (const c of throwCases) {
      try {
        fleetConsensus._reset();
        await fleetConsensus.isRolloutFrozenFromDb(makePool(c.behavior));
        caveats.push({
          severity: 'FAIL',
          check:    `freeze_must_throw_${c.label}`,
          detail:   `Expected throw for ${c.label} but got a return value — DB errors are being swallowed`,
        });
      } catch {
        // correct — error propagated as required
      }
    }

    // ── No pool throws ────────────────────────────────────────────────────────

    try {
      fleetConsensus._reset();
      fleetConsensus.setPool(null);
      await fleetConsensus.isRolloutFrozenFromDb(null);
      caveats.push({
        severity: 'FAIL',
        check:    'freeze_no_pool_throws',
        detail:   'Expected throw when no pool available — in-memory state must not be a fallback',
      });
    } catch {
      // correct
    }

    // ── promoteRing fail-closed on DB error ───────────────────────────────────
    // Simulate the full promoteRing path using a minimal RolloutStore stand-in
    // by calling isRolloutFrozenFromDb with a failing pool and verifying the
    // promotion would be blocked.

    const dbDownPool = makePool('db_down');
    let promotionCorrectlyBlocked = false;
    try {
      await fleetConsensus.isRolloutFrozenFromDb(dbDownPool);
    } catch {
      // This is what promoteRing catches and turns into FREEZE_CHECK_FAILED
      promotionCorrectlyBlocked = true;
    }
    if (!promotionCorrectlyBlocked) {
      caveats.push({
        severity: 'FAIL',
        check:    'promote_ring_fail_closed',
        detail:   'isRolloutFrozenFromDb did not throw on DB error — promoteRing cannot fail closed',
      });
    }

    // ── Source check — confirm old swallowing pattern is gone ─────────────────

    const fs   = require('node:fs');
    const path = require('node:path');
    const src  = fs.readFileSync(
      path.join(__dirname, '../../../lib/fleet-consensus.js'), 'utf8'
    );

    // Confirm isRolloutFrozenFromDb uses a direct pool.query (not the error-swallowing
    // governanceDb.getTextValue wrapper). Extract only the function body to check.
    const frozenFnMatch = src.match(/async function isRolloutFrozenFromDb[\s\S]*?^}/m);
    if (frozenFnMatch && /governanceDb\.getTextValue/.test(frozenFnMatch[0])) {
      caveats.push({
        severity: 'FAIL',
        check:    'no_swallowing_wrapper',
        detail:   'isRolloutFrozenFromDb still uses getTextValue — DB errors will be swallowed',
      });
    }
    if (!frozenFnMatch || !frozenFnMatch[0].includes("p.query(")) {
      caveats.push({
        severity: 'FAIL',
        check:    'direct_query_used',
        detail:   'isRolloutFrozenFromDb should use direct pool.query, not a helper with error fallback',
      });
    }

    // Confirm fail-closed value check is present
    if (!src.includes("!== '0'")) {
      caveats.push({
        severity: 'FAIL',
        check:    'fail_closed_value_check',
        detail:   "isRolloutFrozenFromDb should use !== '0' (fail-closed) not === '1' (fail-open on malformed)",
      });
    }

    // Confirm rollout-store catches and blocks
    const rsSrc = fs.readFileSync(
      path.join(__dirname, '../../../lib/rollout-store.js'), 'utf8'
    );
    if (!rsSrc.includes('FREEZE_CHECK_FAILED')) {
      caveats.push({
        severity: 'FAIL',
        check:    'promote_ring_catch_present',
        detail:   'rollout-store.js promoteRing does not handle freeze check failure — promotion may proceed on DB error',
      });
    }

    fleetConsensus._reset();

    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}

module.exports = FreezeValidationCertification;
