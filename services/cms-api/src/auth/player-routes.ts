/**
 * ADR-001 Player Route Registry — canonical source of truth.
 *
 * Defines the player endpoint surface that operates outside JWT authentication.
 * screen_id UUID possession is the trust boundary for these routes.
 *
 * RULES:
 *   - Each entry is [HTTP_METHOD, RegExp] — both must match for bypass to apply.
 *   - Patterns are anchored (^ and $) — no prefix or suffix bleed.
 *   - UUID pattern is strict: 8-4-4-4-12 lowercase hex only.
 *   - Adding a route here is a security decision. Reference ADR-001.
 *
 * IMPORT THIS FILE — do not duplicate these patterns elsewhere.
 * The regression test suite (auth-boundary.test.ts) imports from here too.
 */

/** Strict UUID segment: matches one UUID path component, nothing else. */
export const UUID_SEG = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Player endpoint definitions.
 * Method must be uppercase. Pattern must be anchored.
 */
export interface PlayerRoute {
  readonly method: string;
  readonly pattern: RegExp;
  readonly description: string;
}

export const PLAYER_ROUTES: readonly PlayerRoute[] = [
  {
    method: 'POST',
    pattern: /^\/api\/v2\/enroll$/,
    description: 'First-boot device enrollment (consumes single-use token)',
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/resolve/${UUID_SEG}$`),
    description: 'Playlist resolution — 60s corpus poll delivery',
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/v2/screens/${UUID_SEG}/corpus$`),
    description: 'Corpus + asset URL delivery — 60s poll',
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/v2/screens/${UUID_SEG}/heartbeat$`),
    description: 'Player health telemetry — 30s poll',
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/v2/screens/${UUID_SEG}/commands/pending$`),
    description: 'Remote command poll',
  },
  {
    method: 'PATCH',
    pattern: new RegExp(`^/api/v2/commands/${UUID_SEG}/status$`),
    description: 'Remote command acknowledgement',
  },
] as const;

/** Returns true if the request matches the player endpoint surface. */
export function isPlayerRoute(method: string, url: string): boolean {
  return PLAYER_ROUTES.some(r => r.method === method && r.pattern.test(url));
}
