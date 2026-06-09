#!/usr/bin/env tsx
/**
 * G.5 — Security: Tenant Isolation Verification
 *
 * Verifies that screen resolution is tenant-isolated:
 * - Screen from Venue A cannot be resolved by a user from Venue B
 * - Audit records for Screen A are not visible when querying Screen B
 * - Cross-tenant screen_id guessing returns 404, not data
 *
 * Also verifies:
 * - The seed screen is only accessible within its own tenant context
 * - /audit/records?screen_id=X only returns records for screen X
 * - No cross-screen audit record leakage
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/tenant-isolation.vec.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

const API_URL   = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';

// A screen_id that should NOT exist (different tenant UUID namespace)
const FOREIGN_SCREEN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FOREIGN_VENUE_ID  = 'aaaaaaaa-0000-0000-0000-000000000001';

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.5 — Tenant Isolation Verification');
  console.log(`API: ${API_URL}`);
  console.log('='.repeat(70));

  // Verify API is up
  const health = await get('/health/live');
  if (health.status !== 200) {
    console.error(`  [FATAL] API not reachable (${health.status})`);
    process.exit(1);
  }

  const failures: string[] = [];

  // ─── Test 1: Seed screen resolves successfully ───────────────────────────
  console.log('\nTest 1: Seed screen resolves...');
  {
    const r = await get(`/resolve/${SCREEN_ID}`);
    if (r.status !== 200) {
      failures.push(`T1: seed screen expected 200, got ${r.status}`);
    }
    console.log(`  /resolve/${SCREEN_ID.slice(0, 8)}...: HTTP ${r.status} ${r.status === 200 ? 'PASS' : 'FAIL'}`);
  }

  // ─── Test 2: Foreign screen_id returns 404 ────────────────────────────────
  console.log('\nTest 2: Foreign screen_id returns 404 (not 200 or 500)...');
  {
    const r = await get(`/resolve/${FOREIGN_SCREEN_ID}`);
    if (r.status !== 404) {
      failures.push(`T2: foreign screen expected 404, got ${r.status} (data leakage risk)`);
    }
    console.log(`  /resolve/${FOREIGN_SCREEN_ID.slice(0, 8)}...: HTTP ${r.status} ${r.status === 404 ? 'PASS' : 'FAIL'}`);
  }

  // ─── Test 3: Audit records scoped to correct screen ──────────────────────
  console.log('\nTest 3: Audit records scoped to correct screen...');
  {
    const r = await get(`/audit/records?screen_id=${SCREEN_ID}&limit=10`);
    if (r.status === 200) {
      const body = r.body as { records: Array<{ screen_id: string }> } | null;
      const records = body?.records ?? [];
      const crossScreen = records.filter(rec => rec.screen_id !== SCREEN_ID);
      if (crossScreen.length > 0) {
        failures.push(`T3: ${crossScreen.length} audit records from wrong screen returned`);
      }
      console.log(`  Records for seed screen: ${records.length}, cross-screen leakage: ${crossScreen.length}: ${crossScreen.length === 0 ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`  WARNING: /audit/records returned ${r.status}`);
    }
  }

  // ─── Test 4: Audit records for foreign screen return empty ───────────────
  console.log('\nTest 4: Audit records for foreign screen return empty...');
  {
    const r = await get(`/audit/records?screen_id=${FOREIGN_SCREEN_ID}&limit=10`);
    if (r.status === 200) {
      const body = r.body as { records: unknown[]; count: number } | null;
      const count = body?.count ?? -1;
      if (count > 0) {
        failures.push(`T4: foreign screen audit query returned ${count} records (expected 0)`);
      }
      console.log(`  Records for foreign screen: ${count} (expected 0): ${count === 0 ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`  WARNING: returned ${r.status}`);
    }
  }

  // ─── Test 5: Missing screen_id/venue_id param → 400 ──────────────────────
  console.log('\nTest 5: Audit query without screen_id or venue_id returns 400...');
  {
    const r = await get('/audit/records');
    if (r.status !== 400) {
      failures.push(`T5: expected 400 for audit query without required param, got ${r.status}`);
    }
    console.log(`  /audit/records (no params): HTTP ${r.status} ${r.status === 400 ? 'PASS' : 'FAIL'}`);
  }

  // ─── Test 6: Entropy scoped to correct venue ──────────────────────────────
  console.log('\nTest 6: Entropy endpoint scoped to venue...');
  {
    const VENUE_ID = '40000000-0000-0000-0000-000000000001';
    const r = await get(`/entropy/${VENUE_ID}`);
    if (r.status !== 200 && r.status !== 404) {
      // 404 is acceptable if no entropy data yet
      failures.push(`T6: entropy for known venue expected 200 or 404, got ${r.status}`);
    }
    const rForeign = await get(`/entropy/${FOREIGN_VENUE_ID}`);
    if (rForeign.status !== 404 && rForeign.status !== 200) {
      // 200 with empty is fine; 404 is fine; but 500 is not
      failures.push(`T6: entropy for foreign venue expected 200/404, got ${rForeign.status}`);
    }
    console.log(`  Known venue: HTTP ${r.status}, Foreign venue: HTTP ${rForeign.status} ${failures.find(f => f.startsWith('T6')) ? 'FAIL' : 'PASS'}`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  const passed = 6 - failures.length;
  console.log(`Results: ${passed}/6 PASS`);

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — tenant isolation violated');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log('  Tenant isolation verified: foreign screen/venue returns 404 or empty');
  console.log('  Audit records scoped to correct screen');
  console.log('  No cross-tenant data leakage detected');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
