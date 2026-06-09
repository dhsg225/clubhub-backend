#!/usr/bin/env tsx
/**
 * G.4 — Full-Stack Chaos Validation: Integrated Scenarios
 *
 * Re-runs all constitutional chaos scenarios against the real PRE engine
 * with degraded system states. Verifies that:
 *
 * - Emergency overrides ALL other resolution (LEVEL_0 absolute)
 * - PRE never throws on missing/degraded state (graceful fallback)
 * - Invariants pass under every degraded scenario
 * - PRE output remains deterministic per-scenario (100x each)
 * - No silent nondeterminism introduced by chaos conditions
 *
 * This is a PRE-layer chaos test (no network required).
 * For API-level chaos, see outage-recovery.ts.
 *
 * Usage:
 *   tsx scripts/validation/integrated-chaos.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { resolve } from '../../src/pre/index';
import { runAllInvariants } from '../../src/verification/invariants/index';
import type { PRE_Input, SystemStateSnapshot, PRE_Output } from '../../src/pre/types';

const RUNS_PER_SCENARIO = 100;

interface ChaosScenario {
  id: string;
  description: string;
  state: SystemStateSnapshot;
  expectedLevel: number | null;  // null = any
  expectedFallback: boolean | null;
  expectedEmergency: boolean;
}

// ─── Minimal base state ───────────────────────────────────────────────────────

function baseScreen() {
  return {
    id: 'screen-chaos-001',
    tv_group_id: null,
    area_id: null,
    venue_id: 'venue-chaos-001',
    status: 'active' as const,
    last_seen_at: Date.now(),
    last_checksum: null,
  };
}

function baseVenue() {
  return {
    id: 'venue-chaos-001',
    name: 'Chaos Venue',
    timezone: 'America/Chicago',
    is_active: true,
    org_id: 'org-chaos-001',
  };
}

function baseOrg() {
  return { id: 'org-chaos-001', name: 'Chaos Org' };
}

function emptyState(): SystemStateSnapshot {
  return {
    screen: baseScreen(),
    tv_group: null,
    area: null,
    venue: baseVenue(),
    organization: baseOrg(),
    emergency: null,
    overrides: [],
    schedules: [],
    campaigns: [],
    content_items: [],
    sponsorships: [],
    last_delivery: null,
  };
}

const SCENARIOS: ChaosScenario[] = [
  {
    id: 'CHAOS-G4-001',
    description: 'Empty state — no schedules, campaigns, overrides. Must reach LEVEL_5 fallback.',
    state: emptyState(),
    expectedLevel: 5,
    expectedFallback: true,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-002',
    description: 'Emergency active — must LEVEL_0 regardless of everything else.',
    state: {
      ...emptyState(),
      emergency: {
        id: 'em-001',
        venue_id: 'venue-chaos-001',
        content_id: 'emergency-content-001',
        is_global: true,
        is_active: true,
        activated_at: Date.now() - 60_000,
        reason: 'Test emergency',
      },
      // Even with full schedules/campaigns present, emergency wins
      schedules: [{
        id: 'sched-001',
        campaign_id: 'campaign-001',
        content_id: null,
        target_type: 'venue',
        target_id: 'venue-chaos-001',
        specificity: 1,
        starts_at: Date.now() - 86_400_000,
        expires_at: null,
        days_of_week: [0,1,2,3,4,5,6],
        start_time_minutes: 0,
        end_time_minutes: 1440,
        is_active: true,
        is_fallback: false,
        priority: 1,
      }],
    },
    expectedLevel: 0,
    expectedFallback: false,
    expectedEmergency: true,
  },
  {
    id: 'CHAOS-G4-003',
    description: 'Inactive emergency — must be ignored, normal resolution continues.',
    state: {
      ...emptyState(),
      emergency: {
        id: 'em-inactive',
        venue_id: 'venue-chaos-001',
        content_id: 'emergency-content-001',
        is_global: true,
        is_active: false,  // INACTIVE
        activated_at: Date.now() - 3_600_000,
        reason: 'Cleared emergency',
      },
    },
    expectedLevel: 5,
    expectedFallback: true,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-004',
    description: 'Inactive screen — degraded state, must still resolve (not crash).',
    state: {
      ...emptyState(),
      screen: { ...baseScreen(), status: 'inactive' as const },
    },
    expectedLevel: null,  // may vary — important thing is it doesn't throw
    expectedFallback: null,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-005',
    description: 'Maintenance mode screen — must resolve gracefully.',
    state: {
      ...emptyState(),
      screen: { ...baseScreen(), status: 'maintenance' as const },
    },
    expectedLevel: null,
    expectedFallback: null,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-006',
    description: 'Campaign with no content items — must fallback without crash.',
    state: {
      ...emptyState(),
      campaigns: [{ id: 'campaign-orphan', name: 'Orphan Campaign', status: 'published' as const }],
      schedules: [{
        id: 'sched-orphan',
        campaign_id: 'campaign-orphan',
        content_id: null,
        target_type: 'venue',
        target_id: 'venue-chaos-001',
        specificity: 1,
        starts_at: Date.now() - 86_400_000,
        expires_at: null,
        days_of_week: [0,1,2,3,4,5,6],
        start_time_minutes: 0,
        end_time_minutes: 1440,
        is_active: true,
        is_fallback: false,
        priority: 1,
      }],
      content_items: [],  // EMPTY — campaign has no content
    },
    expectedLevel: 5,  // falls through to LEVEL_5
    expectedFallback: true,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-007',
    description: 'Expired override (expires_at in past) — must be skipped, not crash.',
    state: {
      ...emptyState(),
      overrides: [{
        id: 'override-expired',
        content_id: 'content-override',
        target_type: 'screen',
        target_id: 'screen-chaos-001',
        starts_at: Date.now() - 7_200_000,
        expires_at: Date.now() - 3_600_000,  // EXPIRED 1h ago
        is_operational: true,
        priority: 1,
        reason: 'Expired test override',
        issued_by: null,
      }],
    },
    expectedLevel: 5,
    expectedFallback: true,
    expectedEmergency: false,
  },
  {
    id: 'CHAOS-G4-008',
    description: 'Sponsorship SOV > 100% — PRE must clamp or reject gracefully.',
    state: {
      ...emptyState(),
      sponsorships: [{
        id: 'sponsor-overflow',
        area_id: 'area-001',
        content_id: 'sponsor-content-001',
        sov_pct: 1.5,  // 150% — invalid but must not crash
        starts_at: Date.now() - 86_400_000,
        expires_at: null,
        is_active: true,
      }],
    },
    expectedLevel: 5,  // L4 sponsorship guard should reject or clamp
    expectedFallback: null,
    expectedEmergency: false,
  },
];

const EVAL_AT_MS = 1748264400000; // Fixed: Tuesday 14:00 UTC

function runScenario(scenario: ChaosScenario): {
  passed: boolean;
  failures: string[];
  stable_checksum: string | null;
  resolution_level: number;
} {
  const input: PRE_Input = {
    screen_id: 'screen-chaos-001',
    at: EVAL_AT_MS,
    system_state: scenario.state,
  };

  const checksums = new Set<string>();
  const levels = new Set<number>();
  const errors: string[] = [];
  const failures: string[] = [];
  let lastOutput: PRE_Output | null = null;

  for (let i = 0; i < RUNS_PER_SCENARIO; i++) {
    try {
      const output = resolve(input);
      checksums.add(output.playlist_checksum);
      levels.add(output.resolution_level);
      lastOutput = output;
    } catch (err) {
      errors.push(String(err));
    }
  }

  if (errors.length > 0) {
    failures.push(`resolve() threw ${errors.length}/${RUNS_PER_SCENARIO} times: ${errors[0]}`);
  }
  if (checksums.size > 1) {
    failures.push(`NONDETERMINISM: ${checksums.size} distinct checksums`);
  }
  if (levels.size > 1) {
    failures.push(`NONDETERMINISM: ${levels.size} distinct resolution levels`);
  }

  const stableLevel = [...levels][0] ?? -1;
  const stableChecksum = [...checksums][0] ?? null;

  if (scenario.expectedLevel !== null && stableLevel !== scenario.expectedLevel) {
    failures.push(`Wrong resolution level: expected ${scenario.expectedLevel}, got ${stableLevel}`);
  }
  if (scenario.expectedFallback !== null && lastOutput && lastOutput.is_fallback !== scenario.expectedFallback) {
    failures.push(`Wrong is_fallback: expected ${scenario.expectedFallback}, got ${lastOutput.is_fallback}`);
  }
  if (scenario.expectedEmergency && lastOutput && lastOutput.resolution_level !== 0) {
    failures.push(`Emergency scenario must resolve at LEVEL_0, got ${lastOutput.resolution_level}`);
  }
  if (!scenario.expectedEmergency && lastOutput && lastOutput.resolution_level === 0) {
    failures.push(`Non-emergency scenario resolved at LEVEL_0 (emergency should not activate)`);
  }

  // Run invariants
  if (lastOutput) {
    try {
      runAllInvariants(lastOutput, input);
    } catch (err) {
      failures.push(`Invariant violation: ${String(err)}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    stable_checksum: stableChecksum,
    resolution_level: stableLevel,
  };
}

function main(): void {
  console.log('='.repeat(70));
  console.log('G.4 — Full-Stack Chaos Validation: Integrated Scenarios');
  console.log(`Runs per scenario: ${RUNS_PER_SCENARIO}`);
  console.log(`Scenarios: ${SCENARIOS.length}`);
  console.log('='.repeat(70));

  let passed = 0;
  const allFailures: string[] = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`\n  [${scenario.id}] ${scenario.description}\n  ↳ `);
    const result = runScenario(scenario);

    if (result.passed) {
      passed++;
      console.log(`PASS (level=${result.resolution_level}, checksum=${result.stable_checksum})`);
    } else {
      console.log('FAIL');
      for (const f of result.failures) {
        console.log(`    [FAIL] ${f}`);
        allFailures.push(`${scenario.id}: ${f}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Results: ${passed}/${SCENARIOS.length} PASS`);

  if (allFailures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of allFailures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log(`  All ${SCENARIOS.length} chaos scenarios deterministic`);
  console.log('  Emergency override verified as absolute (LEVEL_0)');
  console.log('  PRE graceful under all degraded states — no crashes');
  console.log('  Invariants pass in all scenarios');
  process.exit(0);
}

main();
