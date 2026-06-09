'use strict';
/**
 * provision-screen.js
 *
 * CLI for provisioning one-time enrollment tokens for ClubHub TV screens.
 * Implements SECURITY_MODEL.md §2.1 operator provisioning flow.
 *
 * Usage:
 *   node scripts/provision-screen.js --screen-id screen-01 --venue-id venue-1 [--expires-days 30]
 *
 * Output:
 *   Prints the one-time enrollment token to stdout.
 *   The token must be delivered to the Pi operator out-of-band (e.g. USB, secure email).
 *   The token hash is stored in the DB; the raw token is never stored.
 *
 * Environment:
 *   DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME
 *   SECRET_KEY (optional for token generation — enrollment tokens use crypto.randomBytes)
 */

require('dotenv').config();

const crypto = require('node:crypto');
const path   = require('node:path');
const { Pool } = require('pg');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Usage:
  node scripts/provision-screen.js --screen-id <id> --venue-id <venue> [options]

Options:
  --screen-id <id>       Screen ID (must exist in screens table)
  --venue-id <venue>     Venue ID (for verification)
  --expires-days <n>     Token validity in days (default: 30)
  --created-by <who>     Operator identifier (default: 'cli')
  --help                 Show this help

Output:
  On success: prints enrollment token to stdout.
  Token is one-time use; store securely and deliver to Pi operator.

Example:
  node scripts/provision-screen.js --screen-id screen-01 --venue-id venue-1 --expires-days 30
`);
  process.exit(0);
}

const screenId   = getArg('--screen-id');
const venueId    = getArg('--venue-id');
const expiresDays = parseInt(getArg('--expires-days') ?? '30', 10);
const createdBy   = getArg('--created-by') ?? 'cli';

if (!screenId) {
  console.error('Error: --screen-id is required');
  process.exit(1);
}

// ── DB connection ─────────────────────────────────────────────────────────────

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host:     process.env.DB_HOST     ?? 'localhost',
      port:     parseInt(process.env.DB_PORT ?? '5433', 10),
      user:     process.env.DB_USER     ?? 'clubhub',
      password: process.env.DB_PASS     ?? 'clubhub',
      database: process.env.DB_NAME     ?? 'clubhub',
    });

// ── Token generation ──────────────────────────────────────────────────────────

function _generateToken() {
  // 32 bytes = 256 bits of entropy — cryptographically strong one-time token
  return crypto.randomBytes(32).toString('hex');
}

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 64);
}

// ── Load governed thresholds ──────────────────────────────────────────────────

let _enrollmentExpiryMs = 2_592_000_000; // 30 days default
try {
  const fs = require('node:fs');
  const t  = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../test-config/thresholds.json'), 'utf8'
  ));
  if (t.security?.enrollment_token_expiry_ms) {
    _enrollmentExpiryMs = t.security.enrollment_token_expiry_ms;
  }
} catch { /* use default */ }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    // Verify screen exists
    const screenCheck = await client.query(
      'SELECT id, venue_id, name FROM screens WHERE id = $1',
      [screenId]
    );

    if (!screenCheck.rows.length) {
      console.error(`Error: Screen '${screenId}' not found in database.`);
      console.error('  Create the screen first: POST /screens { id, venue_id }');
      process.exit(1);
    }

    const screen = screenCheck.rows[0];

    if (venueId && screen.venue_id !== venueId) {
      console.error(`Error: Screen '${screenId}' belongs to venue '${screen.venue_id}', not '${venueId}'.`);
      process.exit(1);
    }

    // Use governed expiry if days not explicitly overridden via CLI
    const expiresMs = args.includes('--expires-days')
      ? expiresDays * 24 * 60 * 60 * 1000
      : _enrollmentExpiryMs;

    const expiresAt = new Date(Date.now() + expiresMs);

    // Revoke any existing PENDING tokens for this screen (idempotent re-provision)
    await client.query(
      `UPDATE enrollment_tokens SET status = 'REVOKED', revoked_at = NOW()
       WHERE screen_id = $1 AND status = 'PENDING'`,
      [screenId]
    );

    // Generate new token
    const rawToken  = _generateToken();
    const tokenHash = _hashToken(rawToken);

    await client.query(
      `INSERT INTO enrollment_tokens (screen_id, token_hash, status, expires_at, created_by)
       VALUES ($1, $2, 'PENDING', $3, $4)`,
      [screenId, tokenHash, expiresAt.toISOString(), createdBy]
    );

    // Output
    console.log('');
    console.log('Enrollment token provisioned:');
    console.log('');
    console.log(`  Screen ID:   ${screenId}`);
    console.log(`  Venue ID:    ${screen.venue_id}`);
    console.log(`  Screen name: ${screen.name ?? '(unnamed)'}`);
    console.log(`  Expires:     ${expiresAt.toISOString()}`);
    console.log(`  Created by:  ${createdBy}`);
    console.log('');
    console.log('  ENROLLMENT TOKEN (deliver to Pi operator securely):');
    console.log('');
    console.log(`  ${rawToken}`);
    console.log('');
    console.log('  Use: POST /screens/enroll { screen_id, enrollment_token }');
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(`Provisioning failed: ${err.message}`);
  process.exit(1);
});
