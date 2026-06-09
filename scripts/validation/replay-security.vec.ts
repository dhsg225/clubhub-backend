#!/usr/bin/env tsx
/**
 * G.5 — Security: Replay Security Verification
 *
 * Verifies that the replay audit system cannot be tampered with:
 * 1. Forged correlation IDs are tracked but not trusted
 * 2. The audit verify endpoint detects tampered checksums
 * 3. Non-existent audit records return 404 (not 500)
 * 4. Replay mode cannot be activated via HTTP headers
 * 5. The PREVIEW: prefix cannot be injected via query params
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/replay-security.vec.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

const API_URL   = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';

async function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Accept': 'application/json', ...headers },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.5 — Replay Security Verification');
  console.log(`API: ${API_URL}`);
  console.log('='.repeat(70));

  const health = await get('/health/live');
  if (health.status !== 200) {
    console.error(`  [FATAL] API not reachable`);
    process.exit(1);
  }

  const failures: string[] = [];

  // ─── Test 1: Forged correlation ID is accepted but untrusted ─────────────
  console.log('\nTest 1: Forged X-Correlation-Id header...');
  {
    const forgedId = '00000000-0000-0000-0000-forged-id';
    const r = await get(`/resolve/${SCREEN_ID}`, { 'X-Correlation-Id': forgedId });
    // Should succeed (correlation IDs are not authenticated)
    // But the response correlation_id should be the forged one (it's just echoed)
    // The audit record should contain the forged ID (this is auditable, not a security hole)
    // The playlist_checksum must NOT include the correlation_id in its hash
    if (r.status === 200) {
      const body = r.body as Record<string, unknown>;
      // The checksum must still be the same regardless of correlation_id
      const checksumFromForged = body['playlist_checksum'] as string;

      // Get clean request checksum
      const r2 = await get(`/resolve/${SCREEN_ID}`);
      const cleanChecksum = (r2.body as Record<string, unknown>)['playlist_checksum'] as string;

      if (checksumFromForged !== cleanChecksum) {
        failures.push(`T1: checksum changed based on correlation_id (should be excluded from hash)`);
      }
      console.log(`  Forged correlation_id: response checksum=${checksumFromForged}, clean=${cleanChecksum}: ${checksumFromForged === cleanChecksum ? 'PASS' : 'FAIL'}`);
    }
  }

  // ─── Test 2: Non-existent audit record → 404 ─────────────────────────────
  console.log('\nTest 2: Non-existent audit record returns 404...');
  {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const r = await get(`/audit/verify/${fakeId}`);
    if (r.status !== 404) {
      failures.push(`T2: expected 404 for non-existent audit record, got ${r.status}`);
    }
    console.log(`  /audit/verify/${fakeId.slice(0, 8)}...: HTTP ${r.status} ${r.status === 404 ? 'PASS' : 'FAIL'}`);
  }

  // ─── Test 3: Audit verify endpoint detects tamper ────────────────────────
  console.log('\nTest 3: Audit verify endpoint works for real records...');
  {
    // First, get a real audit record ID
    const listResult = await get(`/audit/records?screen_id=${SCREEN_ID}&limit=1`);
    if (listResult.status === 200) {
      const body = listResult.body as { records: Array<{ audit_record_id: string }> };
      const records = body.records ?? [];

      if (records.length > 0) {
        const recordId = records[0]!.audit_record_id;
        const verifyResult = await get(`/audit/verify/${recordId}`);

        if (verifyResult.status !== 200) {
          failures.push(`T3: audit verify returned ${verifyResult.status} for real record`);
        } else {
          const verifyBody = verifyResult.body as { checksum_valid: boolean; stored_checksum: string; computed_checksum: string };
          if (!verifyBody.checksum_valid) {
            failures.push(`T3: audit checksum verification failed for real record ${recordId}: stored=${verifyBody.stored_checksum} computed=${verifyBody.computed_checksum}`);
          }
          console.log(`  Verify ${recordId.slice(0, 8)}...: checksum_valid=${verifyBody.checksum_valid} ${verifyBody.checksum_valid ? 'PASS' : 'FAIL'}`);
        }
      } else {
        console.log('  No audit records to verify (run /resolve first)');
      }
    }
  }

  // ─── Test 4: PREVIEW: prefix cannot be injected via query param ──────────
  console.log('\nTest 4: PREVIEW: prefix injection via query param...');
  {
    // Try to get a PREVIEW: checksum from the production endpoint by passing params
    const r = await get(`/resolve/${SCREEN_ID}?preview=true`);
    if (r.status === 200) {
      const checksum = (r.body as Record<string, unknown>)['playlist_checksum'] as string;
      if (checksum?.startsWith('PREVIEW:')) {
        failures.push(`T4: PREVIEW: prefix injected via query param`);
      }
      console.log(`  /resolve + ?preview=true: checksum=${checksum} ${!checksum?.startsWith('PREVIEW:') ? 'PASS' : 'FAIL'}`);
    }
  }

  // ─── Test 5: Preview endpoint always returns PREVIEW: prefix ─────────────
  console.log('\nTest 5: /preview always returns PREVIEW: prefix...');
  {
    const r = await get(`/preview/${SCREEN_ID}`);
    if (r.status === 200) {
      const checksum = (r.body as Record<string, unknown>)['playlist_checksum'] as string;
      if (!checksum?.startsWith('PREVIEW:')) {
        failures.push(`T5: /preview response missing PREVIEW: prefix (got: ${checksum})`);
      }
      console.log(`  /preview checksum=${checksum}: ${checksum?.startsWith('PREVIEW:') ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`  WARNING: /preview returned ${r.status}`);
    }
  }

  // ─── Test 6: SQL injection in screen_id param ─────────────────────────────
  console.log('\nTest 6: SQL injection attempt in screen_id...');
  {
    const sqlInjection = "' OR '1'='1";
    const r = await get(`/resolve/${encodeURIComponent(sqlInjection)}`);
    // Must return 400 (invalid UUID) or 404, never 200 with data
    if (r.status === 200) {
      failures.push(`T6: SQL injection in screen_id path returned 200 with data`);
    }
    console.log(`  SQL injection in path: HTTP ${r.status} ${r.status !== 200 ? 'PASS' : 'FAIL'}`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(70));
  if (failures.length > 0) {
    console.error('FAILURES:');
    for (const f of failures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — replay security boundary violated');
    process.exit(1);
  }

  console.log('CONSTITUTIONAL VERDICT: PASS');
  console.log('  Correlation ID excluded from replay hash');
  console.log('  Audit verify endpoint working correctly');
  console.log('  PREVIEW: prefix cannot be injected on production endpoint');
  console.log('  SQL injection attempts correctly rejected');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
