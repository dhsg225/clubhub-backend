/**
 * Entropy API — read-only access to entropy state.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §14
 *
 * Routes:
 *   GET /entropy/venue/:id
 *   GET /entropy/fleet
 */

import type { SystemStateSnapshot } from '../pre/types';
import type { VenueEntropyReport } from '../entropy/types';
import { computeVenueEntropy } from '../entropy/venue-entropy-runner';
import { assertDeterministicResponse, assertReadOnlyRoute } from './api-contracts';
import type { FleetEntropyResult } from '../entropy/runtime/fleet-entropy-job';
import { FleetEntropyJob } from '../entropy/runtime/fleet-entropy-job';

// ─── API Types ────────────────────────────────────────────────────────────────

export interface EntropyVenueApiRequest {
  venue_id: string;
  correlation_id: string;
}

export interface EntropyVenueApiResponse {
  correlation_id: string;
  venue_id: string;
  report: VenueEntropyReport;
  computed_at: number;
  replay_compatible: true;
}

export interface FleetEntropyApiResponse {
  correlation_id: string;
  result: FleetEntropyResult;
  computed_at: number;
  replay_compatible: true;
}

// ─── Venue Entropy Handler ────────────────────────────────────────────────────

/**
 * Handle a venue entropy request.
 * Computes entropy for the given state and returns a deterministic response.
 */
export function handleEntropyVenueRequest(
  request: EntropyVenueApiRequest,
  state: SystemStateSnapshot,
): EntropyVenueApiResponse {
  assertReadOnlyRoute('handleEntropyVenueRequest');

  const computedAt = state.screen.last_seen_at ?? Date.now();
  const report = computeVenueEntropy([state], computedAt);

  const response: EntropyVenueApiResponse = {
    correlation_id: request.correlation_id,
    venue_id: request.venue_id,
    report,
    computed_at: computedAt,
    replay_compatible: true,
  };

  assertDeterministicResponse(response);

  return response;
}

// ─── Fleet Entropy Handler ────────────────────────────────────────────────────

/**
 * Handle a fleet entropy request.
 * Computes entropy for all venues deterministically.
 */
export function handleEntropyFleetRequest(
  correlationId: string,
  states: Map<string, SystemStateSnapshot>,
): FleetEntropyApiResponse {
  assertReadOnlyRoute('handleEntropyFleetRequest');

  const fleetJob = new FleetEntropyJob();
  const result = fleetJob.run(states);

  const response: FleetEntropyApiResponse = {
    correlation_id: correlationId,
    result,
    computed_at: result.computed_at,
    replay_compatible: true,
  };

  assertDeterministicResponse(response);

  return response;
}
