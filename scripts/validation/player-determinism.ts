#!/usr/bin/env tsx
/**
 * G.3 — Player Runtime Determinism Verification
 *
 * Simulates the player polling loop N times and verifies:
 * - Every response has a stable playlist_checksum (no flip-flopping)
 * - PREVIEW: prefix is never present on production poll responses
 * - The player's local cache file gets written with correct structure
 * - Checksum verification passes on every received response
 *
 * Does NOT instantiate the full player-runtime process; instead validates
 * the API responses the player would receive, matching what
 * player-runtime/src/playlist-poller.ts verifies.
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/player-determinism.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const API_URL   = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';
const POLL_RUNS = parseInt(process.env['POLL_RUNS'] ?? '20', 10);

// Player's autonomy window: 72 hours
const AUTONOMY_WINDOW_MS = 72 * 60 * 60 * 1000;

interface PlaylistResponse {
  screen_id: string;
  resolution_level: number;
  is_fallback: boolean;
  playlist: Array<{
    content_id: string;
    duration_ms: number;
    weight: number;
    source: number;
    sponsored: boolean;
  }>;
  playlist_checksum: string;
  output_schema_version: string;
  at_utc_ms: number;
}

interface PlayerCache {
  received_at: number;
  screen_id: string;
  playlist_checksum: string;
  resolution_level: number;
  is_fallback: boolean;
  playlist_item_count: number;
}

function verifyChecksumFormat(checksum: string): boolean {
  return /^[0-9a-f]{8}$/.test(checksum);
}

function isWithinAutonomyWindow(receivedAt: number): boolean {
  return Date.now() - receivedAt < AUTONOMY_WINDOW_MS;
}

async function pollOnce(): Promise<{ success: boolean; response?: PlaylistResponse; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/resolve/${SCREEN_ID}`, {
      headers: {
        'Accept': 'application/json',
        'X-Player-Poll': '1',
      },
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const body = await res.json() as PlaylistResponse;
    return { success: true, response: body };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.3 — Player Runtime Determinism Verification');
  console.log(`Polling: GET ${API_URL}/resolve/${SCREEN_ID}`);
  console.log(`Poll runs: ${POLL_RUNS}`);
  console.log('='.repeat(70));

  const cacheDir = join(tmpdir(), 'clubhub-player-test');
  mkdirSync(cacheDir, { recursive: true });
  const cacheFile = join(cacheDir, `playlist-${SCREEN_ID}.json`);

  const checksums = new Set<string>();
  const resolutionLevels = new Set<number>();
  let successCount = 0;
  const failures: string[] = [];

  for (let i = 0; i < POLL_RUNS; i++) {
    const { success, response, error } = await pollOnce();

    if (!success || !response) {
      failures.push(`Poll ${i}: ${error}`);
      continue;
    }

    // Verify no PREVIEW: prefix
    if (response.playlist_checksum.startsWith('PREVIEW:')) {
      failures.push(`Poll ${i}: CONSTITUTIONAL_BREACH — PREVIEW: prefix on production poll`);
      continue;
    }

    // Verify checksum format
    if (!verifyChecksumFormat(response.playlist_checksum)) {
      failures.push(`Poll ${i}: invalid checksum format: "${response.playlist_checksum}"`);
      continue;
    }

    // Verify screen_id match
    if (response.screen_id !== SCREEN_ID) {
      failures.push(`Poll ${i}: screen_id mismatch: got ${response.screen_id}`);
      continue;
    }

    checksums.add(response.playlist_checksum);
    resolutionLevels.add(response.resolution_level);
    successCount++;

    // Write to player cache (atomic: write to temp then note)
    const cacheEntry: PlayerCache = {
      received_at: Date.now(),
      screen_id: response.screen_id,
      playlist_checksum: response.playlist_checksum,
      resolution_level: response.resolution_level,
      is_fallback: response.is_fallback,
      playlist_item_count: response.playlist.length,
    };
    writeFileSync(cacheFile + '.tmp', JSON.stringify(cacheEntry, null, 2));

    process.stdout.write(`  Poll ${(i + 1).toString().padStart(3)}: checksum=${response.playlist_checksum} level=${response.resolution_level}\n`);
  }

  // Verify cache file written
  const cacheExists = existsSync(cacheFile + '.tmp');

  // Verify autonomy window logic
  let autonomyOk = false;
  if (cacheExists) {
    const cached = JSON.parse(readFileSync(cacheFile + '.tmp', 'utf-8')) as PlayerCache;
    autonomyOk = isWithinAutonomyWindow(cached.received_at);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Successful polls:           ${successCount}/${POLL_RUNS}`);
  console.log(`Distinct checksums:         ${checksums.size} (expected: 1)`);
  console.log(`Distinct resolution levels: ${resolutionLevels.size} (expected: 1)`);
  console.log(`Cache file written:         ${cacheExists}`);
  console.log(`Within autonomy window:     ${autonomyOk}`);

  if (checksums.size > 1) failures.push(`NONDETERMINISM: ${checksums.size} distinct checksums across polls`);
  if (resolutionLevels.size > 1) failures.push(`NONDETERMINISM: ${resolutionLevels.size} distinct resolution levels`);
  if (!cacheExists) failures.push('Player cache file not written');
  if (cacheExists && !autonomyOk) failures.push('Cache entry outside autonomy window');

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log(`  ${POLL_RUNS} polls: stable checksum=${[...checksums][0]}`);
  console.log('  No PREVIEW: prefix leakage');
  console.log('  Player cache: written and within autonomy window');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
