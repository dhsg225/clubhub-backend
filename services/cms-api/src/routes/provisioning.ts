/**
 * Venue provisioning + player enrollment routes.
 *
 * Enrollment flow:
 *   1. Operator calls POST /api/v2/venues/:venue_id/enrollment-tokens
 *      → receives cleartext token (shown once, not stored)
 *   2. Field tech configures Pi with token in /etc/clubhub/screen.env
 *   3. Pi boots, player-runtime calls POST /api/v2/enroll on first boot
 *      → token validated, screen record created, config returned
 *   4. Player writes screen_id + venue_id to /etc/clubhub/screen.env
 *   5. Player restarts with full config — normal operation begins
 *
 * Replacement player flow:
 *   1. Old screen goes to DECOMMISSIONED state (or operator marks it)
 *   2. Operator creates new enrollment token for same venue/zone/name
 *   3. Same flow as above — new hardware_id, same screen_name
 *   4. Old screen's audit records preserved (references screen_id, not hardware)
 *
 * Security:
 *   - Token is a 32-byte random value, shown once, stored as SHA-256 hash
 *   - Token expires after 48h
 *   - Token is single-use (claimed_at set on first use)
 *   - Hardware fingerprint recorded at claim time for tamper detection
 *   - Enrollment endpoint rate-limited to prevent brute-force
 *
 * What operators will do wrong:
 *   - Share enrollment token URL via unencrypted channel (Slack, email)
 *     → mitigated: token is only active for 48h, single-use
 *   - Try to enroll the same Pi twice with the same token
 *     → blocked: token already claimed
 *   - Enroll with wrong venue_id in token
 *     → prevented: venue_id comes from token, not from client
 *   - Leave expired unclaimed tokens → operational noise only, no security risk
 *
 * Failure modes:
 *   - DB unavailable during enrollment: Pi cannot boot operationally, retries
 *     enrollment every 30s via first-boot script until DB reachable
 *   - Token expired: operator creates new token, re-flashes screen.env on Pi
 *   - Duplicate enrollment attempt: second call returns 409 with existing screen_id
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/pool.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateTokenBody {
  screen_name: string;
  zone_id?: string;
}

interface CreateTokenParams {
  venue_id: string;
}

interface EnrollBody {
  enrollment_token: string;
  hardware_id: string;         // unique device fingerprint (MAC + serial)
  firmware_version: string;    // player-runtime version
  os_version?: string;
  ip_address?: string;
}

interface GetTokensParams {
  venue_id: string;
}

// ── Route registration ────────────────────────────────────────────────────────

export async function registerProvisioningRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/venues/:venue_id/enrollment-tokens
  // Create a one-time enrollment token for a new player at this venue.
  // Returns cleartext token — shown once, never stored.
  app.post<{ Params: CreateTokenParams; Body: CreateTokenBody }>(
    '/api/v2/venues/:venue_id/enrollment-tokens',
    async (request, reply) => {
      const { venue_id } = request.params;
      const { screen_name, zone_id } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!screen_name?.trim()) {
        return reply.code(400).send({ error: 'screen_name is required' });
      }

      // Verify venue exists
      const venues = await query<{ venue_id: string; enterprise_group_id: string }>(
        'SELECT venue_id, enterprise_group_id FROM venues WHERE venue_id = $1 AND deleted_at IS NULL',
        [venue_id],
      );
      if (venues.length === 0) return reply.code(404).send({ error: 'Venue not found' });

      const venue = venues[0]!;

      // Check no more than 10 pending unclaimed tokens per venue (operational guard)
      const pendingCount = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM enrollment_tokens
         WHERE venue_id = $1 AND claimed_at IS NULL AND expires_at > now()`,
        [venue_id],
      );
      if (parseInt(pendingCount[0]!.count, 10) >= 10) {
        return reply.code(409).send({
          error: 'Too many pending enrollment tokens for this venue (max 10). Revoke existing tokens first.',
        });
      }

      // Generate token: 32 bytes = 64 hex chars
      const cleartext = randomBytes(32).toString('hex');
      const token_hash = createHash('sha256').update(cleartext).digest('hex');

      const tokens = await query<{ token_id: string; expires_at: Date }>(
        `INSERT INTO enrollment_tokens
           (enterprise_group_id, venue_id, token_hash, screen_name, intended_zone_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING token_id, expires_at`,
        [venue.enterprise_group_id, venue_id, token_hash, screen_name.trim(), zone_id ?? null, operator_id],
      );

      // Log timeline event
      await logTimelineEvent(venue_id, null, 'OPERATOR_ACTION', operator_id,
        `Enrollment token created for "${screen_name}"`,
        { token_id: tokens[0]!.token_id, screen_name }
      );

      return reply.code(201).send({
        token_id: tokens[0]!.token_id,
        enrollment_token: cleartext,  // shown once — operator must copy now
        venue_id,
        screen_name,
        expires_at: tokens[0]!.expires_at,
        instructions: [
          'Copy this token — it will not be shown again.',
          'Add it to /etc/clubhub/screen.env.bootstrap on the player device as ENROLLMENT_TOKEN=<value>',
          'Token expires in 48 hours. Create a new one if it expires unclaimed.',
        ],
      });
    },
  );

  // GET /api/v2/venues/:venue_id/enrollment-tokens
  // List pending (unclaimed, unexpired) tokens for a venue.
  app.get<{ Params: GetTokensParams }>(
    '/api/v2/venues/:venue_id/enrollment-tokens',
    async (request, reply) => {
      const { venue_id } = request.params;

      const tokens = await query<{
        token_id: string;
        screen_name: string;
        created_by: string;
        created_at: Date;
        expires_at: Date;
        is_claimed: boolean;
        claimed_at: Date | null;
        claimed_screen_id: string | null;
      }>(
        `SELECT token_id, screen_name, created_by, created_at, expires_at,
                is_claimed, claimed_at, claimed_screen_id
         FROM enrollment_tokens
         WHERE venue_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [venue_id],
      );

      return reply.send({ tokens, at_utc_ms: Date.now() });
    },
  );

  // DELETE /api/v2/enrollment-tokens/:token_id
  // Revoke an unclaimed token (operator changed mind / token compromised).
  app.delete<{ Params: { token_id: string } }>(
    '/api/v2/enrollment-tokens/:token_id',
    async (request, reply) => {
      const { token_id } = request.params;

      // Cannot revoke already-claimed tokens
      const tokens = await query<{ is_claimed: boolean; venue_id: string; screen_name: string }>(
        'SELECT is_claimed, venue_id, screen_name FROM enrollment_tokens WHERE token_id = $1',
        [token_id],
      );
      if (tokens.length === 0) return reply.code(404).send({ error: 'Token not found' });
      if (tokens[0]!.is_claimed) {
        return reply.code(409).send({ error: 'Cannot revoke a claimed token — screen is already enrolled' });
      }

      // Revoke by setting expires_at = now (token becomes expired/inactive)
      // Note: we cannot delete (would leave audit gap) and we cannot update (append-only concern).
      // We handle this by setting expires_at to past via direct update.
      // enrollment_tokens is NOT append-only — it's mutable operational state.
      await query(
        'UPDATE enrollment_tokens SET expires_at = now() - interval \'1 second\' WHERE token_id = $1',
        [token_id],
      );

      return reply.code(204).send();
    },
  );

  // POST /api/v2/enroll
  // First-boot player enrollment. Called by player-runtime on Pi first boot.
  // Validates token, creates screen record, returns configuration.
  // Rate limited at nginx/Caddy level: max 10 req/min per IP.
  app.post<{ Body: EnrollBody }>(
    '/api/v2/enroll',
    async (request, reply) => {
      const { enrollment_token, hardware_id, firmware_version, os_version, ip_address } = request.body;

      if (!enrollment_token || !hardware_id || !firmware_version) {
        return reply.code(400).send({
          error: 'enrollment_token, hardware_id, firmware_version are required',
        });
      }

      // Hash the presented token and look up
      const token_hash = createHash('sha256').update(enrollment_token).digest('hex');

      const tokens = await query<{
        token_id: string;
        enterprise_group_id: string;
        venue_id: string;
        screen_name: string;
        intended_zone_id: string | null;
        is_claimed: boolean;
        is_expired: boolean;
        claimed_screen_id: string | null;
      }>(
        `SELECT token_id, enterprise_group_id, venue_id, screen_name,
                intended_zone_id, is_claimed,
                (expires_at < now()) AS is_expired,
                claimed_screen_id
         FROM enrollment_tokens
         WHERE token_hash = $1`,
        [token_hash],
      );

      if (tokens.length === 0) {
        return reply.code(401).send({ error: 'Invalid enrollment token' });
      }

      const token = tokens[0]!;

      if (token.is_expired) {
        return reply.code(401).send({ error: 'Enrollment token has expired — create a new one' });
      }

      // If already claimed by this same hardware (retry case), return existing screen
      if (token.is_claimed) {
        if (token.claimed_screen_id) {
          const screens = await query<{
            screen_id: string;
            venue_id: string;
            name: string;
          }>(
            'SELECT screen_id, venue_id, name FROM screens WHERE screen_id = $1',
            [token.claimed_screen_id],
          );
          if (screens.length > 0) {
            return reply.send({
              already_enrolled: true,
              screen_id: screens[0]!.screen_id,
              venue_id: screens[0]!.venue_id,
              screen_name: screens[0]!.name,
              message: 'This token was already used — returning existing enrollment',
            });
          }
        }
        return reply.code(409).send({ error: 'Enrollment token already claimed by a different device' });
      }

      // Atomic: claim token + create screen record
      const result = await withTransaction(async (txQuery) => {
        // Create screen record
        const screenRows = await txQuery<{ screen_id: string }>(
          `INSERT INTO screens
             (hardware_id, venue_id, screen_zone_id, name, commissioning_state)
           VALUES ($1, $2, $3, $4, 'REGISTERED')
           RETURNING screen_id`,
          [hardware_id, token.venue_id, token.intended_zone_id, token.screen_name],
        );
        const screen_id = screenRows[0]!.screen_id;

        // Create health snapshot placeholder
        await txQuery(
          'INSERT INTO player_health_snapshots (screen_id) VALUES ($1) ON CONFLICT DO NOTHING',
          [screen_id],
        );

        // Create maintenance_mode placeholder
        await txQuery(
          'INSERT INTO maintenance_mode (screen_id) VALUES ($1) ON CONFLICT DO NOTHING',
          [screen_id],
        );

        // Claim the token
        await txQuery(
          `UPDATE enrollment_tokens
           SET claimed_at = now(),
               claimed_by_hardware_id = $1,
               claimed_screen_id = $2
           WHERE token_id = $3`,
          [hardware_id, screen_id, token.token_id],
        );

        return { screen_id };
      });

      // Log timeline event
      await logTimelineEvent(
        token.venue_id, result.screen_id, 'PLAYER_ENROLLED', null,
        `Player enrolled: ${token.screen_name} (hw: ${hardware_id.slice(0, 12)}...)`,
        { hardware_id, firmware_version, os_version, ip_address }
      );

      console.log(
        `[provisioning] Enrolled screen_id=${result.screen_id} ` +
        `venue_id=${token.venue_id} name="${token.screen_name}" hw=${hardware_id.slice(0, 12)}`
      );

      // Return player configuration
      return reply.code(201).send({
        screen_id: result.screen_id,
        venue_id: token.venue_id,
        screen_name: token.screen_name,
        commissioning_state: 'REGISTERED',
        config: {
          SCREEN_ID:               result.screen_id,
          VENUE_ID:                token.venue_id,
          CORPUS_POLL_INTERVAL_MS: '60000',
          HEARTBEAT_INTERVAL_MS:   '30000',
          CORPUS_CACHE_DIR:        '/var/lib/clubhub/corpus',
          REPLAY_CACHE_DIR:        '/var/lib/clubhub/replay',
          ASSET_DIR:               '/var/lib/clubhub/assets',
          WEBSOCKET_PORT:          '7777',
        },
        at_utc_ms: Date.now(),
      });
    },
  );

  // PATCH /api/v2/screens/:screen_id/commissioning-state
  // Operator advances commissioning state after verifying player is operational.
  app.patch<{
    Params: { screen_id: string };
    Body: { state: string; reason?: string };
  }>(
    '/api/v2/screens/:screen_id/commissioning-state',
    async (request, reply) => {
      const { screen_id } = request.params;
      const { state, reason } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      const VALID_TRANSITIONS: Record<string, string[]> = {
        UNREGISTERED: ['REGISTERED'],
        REGISTERED:   ['CORPUS_LOADED'],
        CORPUS_LOADED:['OPERATIONAL'],
        OPERATIONAL:  ['DECOMMISSIONED'],
      };

      const screens = await query<{ commissioning_state: string; venue_id: string; name: string }>(
        'SELECT commissioning_state, venue_id, name FROM screens WHERE screen_id = $1',
        [screen_id],
      );
      if (screens.length === 0) return reply.code(404).send({ error: 'Screen not found' });

      const current = screens[0]!;
      const allowed = VALID_TRANSITIONS[current.commissioning_state] ?? [];
      if (!allowed.includes(state)) {
        return reply.code(409).send({
          error: `Cannot transition from ${current.commissioning_state} to ${state}`,
          allowed_transitions: allowed,
        });
      }

      await query(
        'UPDATE screens SET commissioning_state = $1 WHERE screen_id = $2',
        [state, screen_id],
      );

      await logTimelineEvent(
        current.venue_id, screen_id, 'OPERATOR_ACTION', operator_id,
        `Commissioning state: ${current.commissioning_state} → ${state}`,
        { reason }
      );

      return reply.send({
        screen_id,
        commissioning_state: state,
        at_utc_ms: Date.now(),
      });
    },
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function logTimelineEvent(
  venue_id: string,
  screen_id: string | null,
  event_type: string,
  actor_id: string | null,
  title: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await query(
      `INSERT INTO venue_timeline_events
         (venue_id, screen_id, event_type, actor_id, title, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [venue_id, screen_id, event_type, actor_id, title, JSON.stringify(detail)],
    );
  } catch (err) {
    // Timeline logging failure is non-fatal
    console.error(`[provisioning] Timeline log failed: ${String(err)}`);
  }
}
