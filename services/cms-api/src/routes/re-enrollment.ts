/**
 * Screen re-enrollment routes — hardware replacement flow.
 *
 * When a Pi is physically replaced (hardware failure, loss, damage), the
 * replacement device needs to claim the same screen_id / venue slot without
 * going through the full initial enrollment flow (which allocates a new screen).
 *
 * Flow:
 *   1. Operator calls POST /api/v2/screens/:screen_id/re-enrollment-token
 *      → receives a single-use 32-byte token (valid 24h)
 *   2. Field tech writes token to /etc/clubhub/screen.env on replacement Pi
 *   3. first-boot-enroll.sh detects RE_ENROLLMENT_TOKEN env var and calls
 *      POST /api/v2/enrollment/re-enroll instead of the normal enroll endpoint
 *   4. Route validates token, atomically marks it used + updates hardware_id
 *   5. Player starts with same screen_id/venue_id, retains full audit history
 *
 * Security:
 *   - Token is 32-byte random hex, stored plaintext (no hash — operator sees it once)
 *   - Tokens expire after 24h (shorter window than initial enrollment — re-enrollment
 *     is a supervised operation, not an asynchronous field deployment)
 *   - Single-use: once consumed, any replay attempt returns 409
 *   - Any existing active token for the same screen is invalidated on new issue
 *   - Requires operator auth (JWT or JWT_VERIFY=false in dev)
 *
 * What operators will do wrong:
 *   - Issue token before the replacement Pi is physically on-site
 *     → token expires; issue a new one when ready
 *   - Re-enroll the wrong screen_id (typo in URL)
 *     → audit trail shows which hardware_id enrolled under which screen
 *   - Try to re-enroll after token used
 *     → 409 with clear error; issue a new token
 */
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../db/pool.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSecureToken(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IssueTokenParams {
  screen_id: string;
}

interface IssueTokenBody {
  reason?: string;
  issued_by?: string;
}

interface ReEnrollBody {
  token?: string;
  hardware_id?: string;
  firmware_version?: string;
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function registerReEnrollmentRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/screens/:screen_id/re-enrollment-token
  // Operator issues a re-enrollment token for a screen that needs hardware replacement.
  // The token is returned in plaintext — operator must deliver it to the field tech.
  app.post<{ Params: IssueTokenParams; Body: IssueTokenBody }>(
    '/api/v2/screens/:screen_id/re-enrollment-token',
    async (request, reply) => {
      const { screen_id } = request.params;
      const { reason, issued_by } = request.body;

      if (!reason || !issued_by) {
        return reply.code(400).send({ error: 'reason and issued_by are required' });
      }

      // Check screen exists
      const screens = await query<{ screen_id: string; name: string; venue_id: string }>(
        'SELECT screen_id, name, venue_id FROM screens WHERE screen_id = $1',
        [screen_id],
      );
      if (screens.length === 0) {
        return reply.code(404).send({ error: 'Screen not found' });
      }

      const screen = screens[0]!;

      // Invalidate any existing active token for this screen
      await query(
        `UPDATE screen_re_enrollment_tokens
         SET expires_at = now()
         WHERE screen_id = $1 AND used_at IS NULL AND expires_at > now()`,
        [screen_id],
      );

      // Generate new token
      const token = generateSecureToken(32);

      const result = await query<{ token_id: string; token: string; expires_at: Date }>(
        `INSERT INTO screen_re_enrollment_tokens (screen_id, token, issued_by, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING token_id, token, expires_at`,
        [screen_id, token, issued_by, reason],
      );

      const row = result[0]!;

      console.log(
        `[re-enrollment] Token issued screen_id=${screen_id} ` +
        `name="${screen.name}" issued_by=${issued_by} reason="${reason}"`,
      );

      return reply.code(201).send({
        token_id: row.token_id,
        token: row.token,
        screen_id,
        screen_name: screen.name,
        venue_id: screen.venue_id,
        expires_at: row.expires_at,
        instructions: 'Present this token during first-boot enrollment on the replacement Pi',
      });
    },
  );

  // POST /api/v2/enrollment/re-enroll
  // Called by first-boot-enroll.sh on the replacement Pi.
  // Validates token, atomically marks it used, updates hardware_id on the screen record.
  // No JWT auth required — Pi devices cannot hold operator credentials.
  app.post<{ Body: ReEnrollBody }>(
    '/api/v2/enrollment/re-enroll',
    async (request, reply) => {
      const { token, hardware_id, firmware_version } = request.body;

      if (!token || !hardware_id) {
        return reply.code(400).send({ error: 'token and hardware_id are required' });
      }

      // Look up token
      const tokenRows = await query<{
        token_id: string;
        screen_id: string;
        expires_at: Date;
        used_at: Date | null;
        venue_id: string;
      }>(
        `SELECT t.token_id, t.screen_id, t.expires_at, t.used_at, s.venue_id
         FROM screen_re_enrollment_tokens t
         JOIN screens s ON s.screen_id = t.screen_id
         WHERE t.token = $1`,
        [token],
      );

      if (tokenRows.length === 0) {
        return reply.code(404).send({ error: 'Invalid re-enrollment token' });
      }

      const row = tokenRows[0]!;

      if (row.used_at !== null) {
        return reply.code(409).send({ error: 'Token already used' });
      }

      if (new Date(row.expires_at) < new Date()) {
        return reply.code(410).send({ error: 'Token expired' });
      }

      // Atomic: mark token used + update screen hardware_id
      await withTransaction(async (txQuery) => {
        await txQuery(
          `UPDATE screen_re_enrollment_tokens
           SET used_at = now(), used_by_hardware = $1
           WHERE token_id = $2`,
          [hardware_id, row.token_id],
        );

        await txQuery(
          `UPDATE screens
           SET hardware_id = $1, firmware_version = $2, last_seen_at = now()
           WHERE screen_id = $3`,
          [hardware_id, firmware_version ?? null, row.screen_id],
        );
      });

      console.log(
        `[re-enrollment] Re-enrolled screen_id=${row.screen_id} ` +
        `new_hardware=${hardware_id.slice(0, 12)}... firmware=${firmware_version ?? 'unknown'}`,
      );

      return reply.code(200).send({
        screen_id: row.screen_id,
        venue_id: row.venue_id,
        re_enrolled: true,
        hardware_id,
        enrolled_at: new Date().toISOString(),
      });
    },
  );
}
