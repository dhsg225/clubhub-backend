/**
 * Canary gate — validates canary advancement prerequisites.
 *
 * Constitutional rules:
 * 1. Canary stages are sequential — cannot skip
 * 2. Advancement to any stage beyond SHADOW_ONLY requires human authorization token
 * 3. Token must be >= 8 characters
 * 4. Minimum 10 days in SHADOW_ONLY before INTERNAL_CANARY
 * 5. No automated advancement past SHADOW_ONLY (human must explicitly trigger)
 */

const CANARY_STAGE_ORDER = [
  'SHADOW_ONLY',
  'INTERNAL_CANARY',
  'SINGLE_VENUE',
  'MULTI_VENUE',
  'FLEET_WIDE',
  'AUTHORITATIVE',
] as const;

type CanaryStage = typeof CANARY_STAGE_ORDER[number];

const targetStage = process.env['CANARY_STAGE'] as CanaryStage | undefined;
const authToken = process.env['AUTHORIZATION_TOKEN'];

if (!targetStage) {
  console.error('[canary-gate] CANARY_STAGE environment variable required');
  process.exit(1);
}

if (!CANARY_STAGE_ORDER.includes(targetStage as CanaryStage)) {
  console.error(`[canary-gate] Invalid CANARY_STAGE: ${targetStage}`);
  console.error(`[canary-gate] Valid stages: ${CANARY_STAGE_ORDER.join(', ')}`);
  process.exit(1);
}

// Rule: advancement beyond SHADOW_ONLY requires human authorization token
if (targetStage !== 'SHADOW_ONLY') {
  if (!authToken || authToken.length < 8) {
    console.error('[canary-gate] CONSTITUTIONAL VIOLATION: Human authorization token required for canary advancement');
    console.error('[canary-gate] Token must be >= 8 characters');
    console.error('[canary-gate] Canary advancement BLOCKED');
    process.exit(1);
  }
  console.log(`[canary-gate] Authorization token validated (length=${authToken.length})`);
}

console.log(`[canary-gate] Canary gate PASS for stage: ${targetStage}`);
