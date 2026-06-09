/**
 * Seed script — creates replay-safe Wave 1 fixtures.
 *
 * Uses FIXED UUIDs so that replay verification can reference known entities.
 * All seeds are idempotent (INSERT ... ON CONFLICT DO NOTHING).
 *
 * IMPORTANT: These seeds are development/testing only.
 * Production venues are provisioned via the CMS API.
 */
import { Pool } from 'pg';

// Fixed UUIDs for deterministic replay
export const SEED = {
  PLATFORM_ID:           '10000000-0000-0000-0000-000000000001',
  ENTERPRISE_GROUP_ID:   '20000000-0000-0000-0000-000000000001',
  REGIONAL_ORG_ID:       '30000000-0000-0000-0000-000000000001',
  VENUE_ID:              '40000000-0000-0000-0000-000000000001',
  SCREEN_ZONE_ID:        '50000000-0000-0000-0000-000000000001',
  SCREEN_ID:             '60000000-0000-0000-0000-000000000001',
  CONTENT_ASSET_ID:      '70000000-0000-0000-0000-000000000001',
  CAMPAIGN_ID:           '80000000-0000-0000-0000-000000000001',
  CAMPAIGN_ITEM_ID:      '90000000-0000-0000-0000-000000000001',
  SCHEDULE_ID:           'a0000000-0000-0000-0000-000000000001',
} as const;

export async function runSeed(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Platform
    await client.query(
      `INSERT INTO platforms (platform_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [SEED.PLATFORM_ID, 'ClubHub Demo Platform'],
    );

    // Enterprise group
    await client.query(
      `INSERT INTO enterprise_groups (enterprise_group_id, name, slug)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [SEED.ENTERPRISE_GROUP_ID, 'Demo Enterprise', 'demo-enterprise'],
    );

    // Regional org
    await client.query(
      `INSERT INTO regional_organizations (regional_org_id, enterprise_group_id, name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [SEED.REGIONAL_ORG_ID, SEED.ENTERPRISE_GROUP_ID, 'Demo Region'],
    );

    // Venue (LICENSED_CLUB, GRADE_B, UTC)
    await client.query(
      `INSERT INTO venues (venue_id, enterprise_group_id, regional_org_id, name, market_vertical, timezone)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [SEED.VENUE_ID, SEED.ENTERPRISE_GROUP_ID, SEED.REGIONAL_ORG_ID, 'Demo Venue', 'LICENSED_CLUB', 'Europe/London'],
    );

    // Screen zone
    await client.query(
      `INSERT INTO screen_zones (screen_zone_id, venue_id, name, zone_type)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [SEED.SCREEN_ZONE_ID, SEED.VENUE_ID, 'Main Bar', 'BAR'],
    );

    // Screen (OPERATIONAL)
    await client.query(
      `INSERT INTO screens (screen_id, venue_id, screen_zone_id, name, commissioning_state, first_boot_determinism_passed)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [SEED.SCREEN_ID, SEED.VENUE_ID, SEED.SCREEN_ZONE_ID, 'Bar Screen 1', 'OPERATIONAL', true],
    );

    // Content asset (10s video)
    await client.query(
      `INSERT INTO content_assets (content_asset_id, enterprise_group_id, filename, media_type, duration_ms, file_size_bytes, checksum_sha256, cdn_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [
        SEED.CONTENT_ASSET_ID,
        SEED.ENTERPRISE_GROUP_ID,
        'demo-promo.mp4',
        'video/mp4',
        10_000,
        1_048_576,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // sha256 of empty (placeholder)
        'https://cdn.clubhub.example/assets/demo-promo.mp4',
      ],
    );

    // Campaign (already has preview session for approval gate bypass in seed)
    await client.query(
      `INSERT INTO campaigns (campaign_id, enterprise_group_id, venue_id, name, resolution_level, status, has_preview_session, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [SEED.CAMPAIGN_ID, SEED.ENTERPRISE_GROUP_ID, SEED.VENUE_ID, 'Demo Campaign', 3, 'ACTIVE', true, 'seed-runner'],
    );

    // Campaign item
    await client.query(
      `INSERT INTO campaign_items (campaign_item_id, campaign_id, content_asset_id, weight)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [SEED.CAMPAIGN_ITEM_ID, SEED.CAMPAIGN_ID, SEED.CONTENT_ASSET_ID, 1.0],
    );

    // Schedule (Mon-Fri, 09:00-17:00, venue-level, specificity=1)
    await client.query(
      `INSERT INTO schedules (schedule_id, campaign_id, days_of_week, start_time_hhmm, end_time_hhmm,
                              valid_from_utc, target_type, target_id, specificity, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
      [
        SEED.SCHEDULE_ID,
        SEED.CAMPAIGN_ID,
        [1, 2, 3, 4, 5], // Mon-Fri
        900,             // 09:00
        1700,            // 17:00
        '2026-01-01T00:00:00Z',
        'venue',
        SEED.VENUE_ID,
        1,   // venue specificity
        0,
      ],
    );

    await client.query('COMMIT');
    console.log('[seed] Wave 1 seed fixtures applied');
    console.log(`[seed] Screen ID for testing: ${SEED.SCREEN_ID}`);
    console.log(`[seed] Venue ID: ${SEED.VENUE_ID}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** CLI entry point. */
async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'clubhub',
    user: process.env['DB_USER'] ?? 'clubhub_app',
    password: process.env['DB_PASSWORD'] ?? '',
  });

  try {
    await runSeed(pool);
    console.log('[seed] Done');
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes('seed')) {
  main().catch(err => {
    console.error('[seed] Fatal:', err);
    process.exit(1);
  });
}
